package com.papervest.portfolio.service;

import com.papervest.common.util.MoneyUtils;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class PerformanceReturnCalculator {

	private static final int DECIMAL_SCALE = 10;
	private static final int PERCENT_SCALE = 2;
	private static final double MIN_RATE = -0.999999;
	private static final double INITIAL_MAX_RATE = 10.0;
	private static final double MAX_RATE = 1000.0;
	private static final double NPV_TOLERANCE = 0.000001;
	private static final int MAX_ITERATIONS = 100;

	public BigDecimal periodReturnPercent(
			BigDecimal startValue,
			BigDecimal endValue,
			BigDecimal netCashFlow
	) {
		if (startValue == null || startValue.compareTo(BigDecimal.ZERO) <= 0) {
			return zeroPercent();
		}

		BigDecimal adjustedGain = endValue
				.subtract(netCashFlow == null ? BigDecimal.ZERO : netCashFlow)
				.subtract(startValue);
		return MoneyUtils.percent(adjustedGain, startValue);
	}

	public BigDecimal chainTwrPercent(List<BigDecimal> periodReturnPercents) {
		BigDecimal factor = BigDecimal.ONE;
		for (BigDecimal periodReturnPercent : periodReturnPercents) {
			BigDecimal periodFactor = BigDecimal.ONE.add(
					periodReturnPercent.divide(BigDecimal.valueOf(100), DECIMAL_SCALE, RoundingMode.HALF_UP)
			);
			factor = factor.multiply(periodFactor);
		}
		return factor
				.subtract(BigDecimal.ONE)
				.multiply(BigDecimal.valueOf(100))
				.setScale(PERCENT_SCALE, RoundingMode.HALF_UP);
	}

	public Optional<BigDecimal> moneyWeightedReturnPercent(List<DatedCashFlow> cashFlows) {
		List<DatedCashFlow> orderedCashFlows = cashFlows.stream()
				.sorted(Comparator.comparing(DatedCashFlow::date))
				.toList();
		if (orderedCashFlows.size() < 2
				|| orderedCashFlows.stream().map(DatedCashFlow::date).distinct().count() < 2
				|| !hasPositiveAndNegativeCashFlows(orderedCashFlows)) {
			return Optional.empty();
		}

		LocalDate startDate = orderedCashFlows.getFirst().date();
		double lower = MIN_RATE;
		double upper = INITIAL_MAX_RATE;
		double lowerNpv = netPresentValue(orderedCashFlows, startDate, lower);
		double upperNpv = netPresentValue(orderedCashFlows, startDate, upper);

		while (sameSign(lowerNpv, upperNpv) && upper < MAX_RATE) {
			upper = upper * 2;
			upperNpv = netPresentValue(orderedCashFlows, startDate, upper);
		}

		if (!Double.isFinite(lowerNpv) || !Double.isFinite(upperNpv) || sameSign(lowerNpv, upperNpv)) {
			return Optional.empty();
		}

		double midpoint = 0;
		for (int iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
			midpoint = (lower + upper) / 2.0;
			double midpointNpv = netPresentValue(orderedCashFlows, startDate, midpoint);
			if (!Double.isFinite(midpointNpv)) {
				return Optional.empty();
			}
			if (Math.abs(midpointNpv) <= NPV_TOLERANCE) {
				break;
			}
			if (sameSign(lowerNpv, midpointNpv)) {
				lower = midpoint;
				lowerNpv = midpointNpv;
			} else {
				upper = midpoint;
			}
		}

		return Optional.of(BigDecimal.valueOf(midpoint * 100).setScale(PERCENT_SCALE, RoundingMode.HALF_UP));
	}

	private boolean hasPositiveAndNegativeCashFlows(List<DatedCashFlow> cashFlows) {
		boolean hasPositive = cashFlows.stream().anyMatch(cashFlow -> cashFlow.amount().compareTo(BigDecimal.ZERO) > 0);
		boolean hasNegative = cashFlows.stream().anyMatch(cashFlow -> cashFlow.amount().compareTo(BigDecimal.ZERO) < 0);
		return hasPositive && hasNegative;
	}

	private double netPresentValue(List<DatedCashFlow> cashFlows, LocalDate startDate, double rate) {
		double base = 1.0 + rate;
		if (base <= 0) {
			return Double.NaN;
		}

		double total = 0;
		for (DatedCashFlow cashFlow : cashFlows) {
			long days = ChronoUnit.DAYS.between(startDate, cashFlow.date());
			double years = days / 365.0;
			total += cashFlow.amount().doubleValue() / Math.pow(base, years);
		}
		return total;
	}

	private boolean sameSign(double left, double right) {
		return (left < 0 && right < 0) || (left > 0 && right > 0);
	}

	private BigDecimal zeroPercent() {
		return BigDecimal.ZERO.setScale(PERCENT_SCALE, RoundingMode.HALF_UP);
	}

	public record DatedCashFlow(LocalDate date, BigDecimal amount) {
	}
}

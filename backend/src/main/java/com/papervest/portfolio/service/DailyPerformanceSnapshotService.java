package com.papervest.portfolio.service;

import com.papervest.portfolio.dto.PortfolioResponse;
import com.papervest.portfolio.model.DailyPerformanceSnapshot;
import com.papervest.portfolio.repository.DailyPerformanceSnapshotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class DailyPerformanceSnapshotService {

	private final DailyPerformanceSnapshotRepository dailyPerformanceSnapshotRepository;
	private final PortfolioValuationService portfolioValuationService;
	private final PerformanceReturnCalculator performanceReturnCalculator;

	public DailyPerformanceSnapshotService(
			DailyPerformanceSnapshotRepository dailyPerformanceSnapshotRepository,
			PortfolioValuationService portfolioValuationService,
			PerformanceReturnCalculator performanceReturnCalculator
	) {
		this.dailyPerformanceSnapshotRepository = dailyPerformanceSnapshotRepository;
		this.portfolioValuationService = portfolioValuationService;
		this.performanceReturnCalculator = performanceReturnCalculator;
	}

	@Transactional
	public DailyPerformanceSnapshot recordDailySnapshot(UUID userId, LocalDate performanceDate) {
		PortfolioResponse portfolio = portfolioValuationService.getPortfolio(userId);
		List<DailyPerformanceSnapshot> priorSnapshots = dailyPerformanceSnapshotRepository
				.findByUserIdAndPerformanceDateLessThanEqualOrderByPerformanceDateAsc(userId, performanceDate)
				.stream()
				.filter(snapshot -> snapshot.getPerformanceDate().isBefore(performanceDate))
				.toList();
		Optional<DailyPerformanceSnapshot> existingSnapshot = dailyPerformanceSnapshotRepository
				.findByUserIdAndPerformanceDate(userId, performanceDate);

		BigDecimal currentValue = portfolio.summary().totalPortfolioValue();
		BigDecimal netCashFlow = zeroMoney();
		BigDecimal periodReturnPercent = calculatePeriodReturn(priorSnapshots, currentValue, netCashFlow);
		BigDecimal cumulativeTwrPercent = calculateCumulativeTwr(priorSnapshots, periodReturnPercent);
		BigDecimal cumulativeMwrPercent = calculateCumulativeMwr(priorSnapshots, performanceDate, currentValue)
				.orElse(null);

		DailyPerformanceSnapshot snapshot = existingSnapshot.orElseGet(() -> new DailyPerformanceSnapshot(
				userId,
				performanceDate,
				currentValue,
				portfolio.summary().cashBalance(),
				portfolio.summary().holdingsMarketValue(),
				portfolio.summary().realizedPnl(),
				portfolio.summary().unrealizedPnl(),
				netCashFlow,
				periodReturnPercent,
				cumulativeTwrPercent,
				cumulativeMwrPercent
		));

		if (existingSnapshot.isPresent()) {
			snapshot.updateValues(
					currentValue,
					portfolio.summary().cashBalance(),
					portfolio.summary().holdingsMarketValue(),
					portfolio.summary().realizedPnl(),
					portfolio.summary().unrealizedPnl(),
					netCashFlow,
					periodReturnPercent,
					cumulativeTwrPercent,
					cumulativeMwrPercent
			);
		}

		return dailyPerformanceSnapshotRepository.save(snapshot);
	}

	private BigDecimal calculatePeriodReturn(
			List<DailyPerformanceSnapshot> priorSnapshots,
			BigDecimal currentValue,
			BigDecimal netCashFlow
	) {
		if (priorSnapshots.isEmpty()) {
			return zeroPercent();
		}
		return performanceReturnCalculator.periodReturnPercent(
				priorSnapshots.getLast().getTotalPortfolioValue(),
				currentValue,
				netCashFlow
		);
	}

	private BigDecimal calculateCumulativeTwr(
			List<DailyPerformanceSnapshot> priorSnapshots,
			BigDecimal periodReturnPercent
	) {
		if (priorSnapshots.isEmpty()) {
			return zeroPercent();
		}
		return performanceReturnCalculator.chainTwrPercent(List.of(
				priorSnapshots.getLast().getCumulativeTwrPercent(),
				periodReturnPercent
		));
	}

	private Optional<BigDecimal> calculateCumulativeMwr(
			List<DailyPerformanceSnapshot> priorSnapshots,
			LocalDate performanceDate,
			BigDecimal currentValue
	) {
		if (priorSnapshots.isEmpty()) {
			return Optional.empty();
		}

		List<PerformanceReturnCalculator.DatedCashFlow> cashFlows = new ArrayList<>();
		DailyPerformanceSnapshot firstSnapshot = priorSnapshots.getFirst();
		cashFlows.add(new PerformanceReturnCalculator.DatedCashFlow(
				firstSnapshot.getPerformanceDate(),
				firstSnapshot.getTotalPortfolioValue().negate()
		));
		for (DailyPerformanceSnapshot snapshot : priorSnapshots.subList(1, priorSnapshots.size())) {
			if (snapshot.getNetCashFlow().compareTo(BigDecimal.ZERO) != 0) {
				cashFlows.add(new PerformanceReturnCalculator.DatedCashFlow(
						snapshot.getPerformanceDate(),
						snapshot.getNetCashFlow().negate()
				));
			}
		}
		cashFlows.add(new PerformanceReturnCalculator.DatedCashFlow(performanceDate, currentValue));
		return performanceReturnCalculator.moneyWeightedReturnPercent(cashFlows);
	}

	private BigDecimal zeroMoney() {
		return BigDecimal.ZERO.setScale(2);
	}

	private BigDecimal zeroPercent() {
		return BigDecimal.ZERO.setScale(2);
	}
}

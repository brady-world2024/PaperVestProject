package com.papervest.portfolio.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PerformanceReturnCalculatorTest {

	private final PerformanceReturnCalculator calculator = new PerformanceReturnCalculator();

	@Test
	void periodReturnSubtractsNetCashFlow() {
		BigDecimal result = calculator.periodReturnPercent(
				new BigDecimal("100000.00"),
				new BigDecimal("112000.00"),
				new BigDecimal("2000.00")
		);

		assertThat(result).isEqualByComparingTo("10.00");
	}

	@Test
	void periodReturnIsZeroWhenStartValueIsZero() {
		BigDecimal result = calculator.periodReturnPercent(
				BigDecimal.ZERO,
				new BigDecimal("112000.00"),
				BigDecimal.ZERO
		);

		assertThat(result).isEqualByComparingTo("0.00");
	}

	@Test
	void twrChainsPeriodReturns() {
		BigDecimal result = calculator.chainTwrPercent(List.of(
				new BigDecimal("10.00"),
				new BigDecimal("-5.00")
		));

		assertThat(result).isEqualByComparingTo("4.50");
	}

	@Test
	void mwrReturnsEmptyWhenCashFlowsAreInsufficient() {
		var result = calculator.moneyWeightedReturnPercent(List.of(
				new PerformanceReturnCalculator.DatedCashFlow(
						LocalDate.parse("2026-01-01"),
						new BigDecimal("-100000.00")
				)
		));

		assertThat(result).isEmpty();
	}

	@Test
	void mwrSolvesAnnualizedMoneyWeightedReturn() {
		var result = calculator.moneyWeightedReturnPercent(List.of(
				new PerformanceReturnCalculator.DatedCashFlow(
						LocalDate.parse("2026-01-01"),
						new BigDecimal("-100000.00")
				),
				new PerformanceReturnCalculator.DatedCashFlow(
						LocalDate.parse("2027-01-01"),
						new BigDecimal("110000.00")
				)
		));

		assertThat(result).hasValueSatisfying(value -> assertThat(value).isEqualByComparingTo("10.00"));
	}

	@Test
	void mwrReturnsEmptyWhenCashFlowsHaveNoSignChange() {
		var result = calculator.moneyWeightedReturnPercent(List.of(
				new PerformanceReturnCalculator.DatedCashFlow(
						LocalDate.parse("2026-01-01"),
						new BigDecimal("100000.00")
				),
				new PerformanceReturnCalculator.DatedCashFlow(
						LocalDate.parse("2027-01-01"),
						new BigDecimal("110000.00")
				)
		));

		assertThat(result).isEmpty();
	}
}

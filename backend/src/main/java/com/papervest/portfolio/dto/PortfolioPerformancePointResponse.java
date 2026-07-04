package com.papervest.portfolio.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record PortfolioPerformancePointResponse(
		Instant timestamp,
		LocalDate date,
		BigDecimal totalPortfolioValue,
		BigDecimal cashBalance,
		BigDecimal holdingsMarketValue,
		BigDecimal periodReturnPercent,
		BigDecimal timeWeightedReturnPercent,
		BigDecimal moneyWeightedReturnPercent,
		BigDecimal netCashFlow,
		BigDecimal drawdownPercent
) {
}

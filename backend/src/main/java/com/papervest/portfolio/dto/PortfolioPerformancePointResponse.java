package com.papervest.portfolio.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record PortfolioPerformancePointResponse(
		Instant timestamp,
		BigDecimal totalPortfolioValue,
		BigDecimal cashBalance,
		BigDecimal holdingsMarketValue,
		BigDecimal drawdownPercent
) {
}

package com.papervest.portfolio.dto;

import java.math.BigDecimal;

public record PortfolioSummaryResponse(
		BigDecimal initialCash,
		BigDecimal cashBalance,
		BigDecimal holdingsMarketValue,
		BigDecimal totalPortfolioValue,
		BigDecimal unrealizedPnl,
		BigDecimal realizedPnl,
		BigDecimal totalPnl,
		BigDecimal totalReturnPercent,
		BigDecimal dailyChange
) {
}

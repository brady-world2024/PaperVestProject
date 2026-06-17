package com.papervest.portfolio.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record PortfolioHistoryPointResponse(
		Instant timestamp,
		BigDecimal totalPortfolioValue,
		BigDecimal cashBalance,
		BigDecimal holdingsMarketValue,
		BigDecimal realizedPnl,
		BigDecimal unrealizedPnl,
		String snapshotSource
) {
}

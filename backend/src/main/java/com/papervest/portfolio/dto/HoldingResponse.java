package com.papervest.portfolio.dto;

import com.papervest.marketdata.model.MarketSessionState;

import java.math.BigDecimal;
import java.time.Instant;

public record HoldingResponse(
		String symbol,
		String companyName,
		BigDecimal quantity,
		BigDecimal averageCost,
		BigDecimal currentPrice,
		BigDecimal costBasis,
		BigDecimal marketValue,
		BigDecimal unrealizedPnl,
		BigDecimal unrealizedPnlPercent,
		BigDecimal dailyChange,
		boolean staleQuote,
		Instant quoteTimestamp,
		MarketSessionState marketSession,
		boolean tradingEnabled,
		String marketTimezone
) {
}

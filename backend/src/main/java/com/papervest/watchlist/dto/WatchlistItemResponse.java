package com.papervest.watchlist.dto;

import com.papervest.marketdata.model.MarketSessionState;

import java.math.BigDecimal;
import java.time.Instant;

public record WatchlistItemResponse(
		String symbol,
		String companyName,
		BigDecimal currentPrice,
		BigDecimal dailyChange,
		BigDecimal dailyChangePercent,
		Instant quoteTimestamp,
		boolean staleQuote,
		MarketSessionState marketSession,
		boolean tradingEnabled,
		String marketTimezone,
		Instant addedAt
) {
}

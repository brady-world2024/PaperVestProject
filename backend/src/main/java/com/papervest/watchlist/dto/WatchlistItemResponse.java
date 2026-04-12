package com.papervest.watchlist.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record WatchlistItemResponse(
		String symbol,
		String companyName,
		BigDecimal currentPrice,
		BigDecimal dailyChange,
		BigDecimal dailyChangePercent,
		boolean staleQuote,
		Instant addedAt
) {
}

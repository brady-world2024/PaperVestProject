package com.papervest.marketdata.model;

import java.time.Instant;
import java.util.List;

public record StockPriceHistory(
		String symbol,
		StockHistoryRange range,
		String interval,
		Instant from,
		Instant to,
		List<StockPriceBar> points
) {
}

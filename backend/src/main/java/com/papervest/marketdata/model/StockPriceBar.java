package com.papervest.marketdata.model;

import java.math.BigDecimal;
import java.time.Instant;

public record StockPriceBar(
		Instant timestamp,
		BigDecimal openPrice,
		BigDecimal highPrice,
		BigDecimal lowPrice,
		BigDecimal closePrice,
		long volume
) {
}

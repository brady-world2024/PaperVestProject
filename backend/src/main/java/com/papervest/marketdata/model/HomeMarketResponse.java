package com.papervest.marketdata.model;

import java.util.List;

public record HomeMarketResponse(
		List<StockQuote> quotes,
		boolean degraded
) {
}

package com.papervest.marketdata.model;

public record StockSearchResult(
		String symbol,
		String companyName,
		String type
) {
}

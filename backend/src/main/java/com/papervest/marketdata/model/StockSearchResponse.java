package com.papervest.marketdata.model;

import java.util.List;

public record StockSearchResponse(List<StockSearchResult> results) {
}

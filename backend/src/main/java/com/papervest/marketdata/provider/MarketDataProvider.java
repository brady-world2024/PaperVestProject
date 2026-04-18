package com.papervest.marketdata.provider;

import com.papervest.marketdata.config.MarketDataProperties;
import com.papervest.marketdata.model.MarketStatusSnapshot;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceHistory;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.model.StockSearchResult;

import java.util.List;

public interface MarketDataProvider {

	MarketDataProperties.ProviderType providerType();

	StockQuote fetchQuote(String symbol);

	MarketStatusSnapshot fetchMarketStatus(String exchange);

	StockPriceHistory fetchPriceHistory(String symbol, StockHistoryRange range);

	List<StockSearchResult> search(String query);

	String resolveCompanyName(String symbol);
}

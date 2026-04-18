package com.papervest.marketdata.model;

import java.math.BigDecimal;
import java.time.Instant;

public record StockQuote(
		String symbol,
		String companyName,
		BigDecimal currentPrice,
		BigDecimal dailyChange,
		BigDecimal dailyChangePercent,
		BigDecimal openPrice,
		BigDecimal highPrice,
		BigDecimal lowPrice,
		BigDecimal previousClose,
		Instant quoteTimestamp,
		boolean stale,
		MarketSessionState marketSession,
		boolean tradingEnabled,
		String marketTimezone
) {
	public StockQuote withCompanyName(String updatedCompanyName) {
		return new StockQuote(
				symbol,
				updatedCompanyName,
				currentPrice,
				dailyChange,
				dailyChangePercent,
				openPrice,
				highPrice,
				lowPrice,
				previousClose,
				quoteTimestamp,
				stale,
				marketSession,
				tradingEnabled,
				marketTimezone
		);
	}

	public StockQuote withStale(boolean updatedStale) {
		return new StockQuote(
				symbol,
				companyName,
				currentPrice,
				dailyChange,
				dailyChangePercent,
				openPrice,
				highPrice,
				lowPrice,
				previousClose,
				quoteTimestamp,
				updatedStale,
				marketSession,
				tradingEnabled,
				marketTimezone
		);
	}

	public StockQuote withMarketContext(
			MarketSessionState updatedMarketSession,
			boolean updatedTradingEnabled,
			String updatedMarketTimezone
	) {
		return new StockQuote(
				symbol,
				companyName,
				currentPrice,
				dailyChange,
				dailyChangePercent,
				openPrice,
				highPrice,
				lowPrice,
				previousClose,
				quoteTimestamp,
				stale,
				updatedMarketSession,
				updatedTradingEnabled,
				updatedMarketTimezone
		);
	}
}

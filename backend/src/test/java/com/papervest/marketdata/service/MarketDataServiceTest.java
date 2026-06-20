package com.papervest.marketdata.service;

import com.papervest.common.exception.ExternalServiceException;
import com.papervest.marketdata.config.MarketDataProperties;
import com.papervest.marketdata.model.HomeMarketResponse;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.MarketStatusSnapshot;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceBar;
import com.papervest.marketdata.model.StockPriceHistory;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.model.StockSearchResult;
import com.papervest.marketdata.provider.MarketDataProvider;
import com.papervest.marketdata.provider.MarketDataProviderRouter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketDataServiceTest {

	@Mock
	private MarketDataProviderRouter providerRouter;

	@Mock
	private MarketDataProvider provider;

	private MarketDataService marketDataService;

	@BeforeEach
	void setUp() {
		when(providerRouter.activeProvider()).thenReturn(provider);
		marketDataService = createService(
				Duration.ofSeconds(30),
				Duration.ofMinutes(15),
				Duration.ofMinutes(5),
				Duration.ofDays(1),
				Duration.ofMinutes(5),
				Duration.ofMinutes(30),
				true,
				List.of(new MarketDataProperties.HomeSymbol("AAPL", "Apple"))
		);
	}

	@Test
	void historyRequestsReuseCachedSeriesForNormalizedSymbolAndRange() {
		StockPriceHistory response = new StockPriceHistory(
				"AAPL",
				StockHistoryRange.ONE_MONTH,
				"1d",
				Instant.parse("2026-01-01T00:00:00Z"),
				Instant.parse("2026-01-31T00:00:00Z"),
				List.of(
						new StockPriceBar(
								Instant.parse("2026-01-15T00:00:00Z"),
								new BigDecimal("100.0000"),
								new BigDecimal("103.0000"),
								new BigDecimal("99.0000"),
								new BigDecimal("102.0000"),
								1200345L
						)
				)
		);

		when(provider.fetchPriceHistory("AAPL", StockHistoryRange.ONE_MONTH)).thenReturn(response);

		StockPriceHistory first = marketDataService.getPriceHistory("aapl", StockHistoryRange.ONE_MONTH);
		StockPriceHistory second = marketDataService.getPriceHistory("AAPL", StockHistoryRange.ONE_MONTH);

		assertThat(first).isEqualTo(response);
		assertThat(second).isEqualTo(response);
		verify(provider, times(1)).fetchPriceHistory("AAPL", StockHistoryRange.ONE_MONTH);
	}

	@Test
	void quoteRequestsAreEnrichedWithOpenSessionContext() {
		when(provider.fetchQuote("AAPL")).thenReturn(baseQuote());
		when(provider.fetchMarketStatus("US")).thenReturn(new MarketStatusSnapshot(
				"US",
				true,
				"regular",
				"America/New_York",
				Instant.parse("2026-01-15T15:00:00Z")
		));

		StockQuote quote = marketDataService.getQuote("AAPL", "Apple Inc.");

		assertThat(quote.marketSession()).isEqualTo(MarketSessionState.OPEN);
		assertThat(quote.tradingEnabled()).isTrue();
		assertThat(quote.marketTimezone()).isEqualTo("America/New_York");
		verify(provider, times(1)).fetchQuote("AAPL");
		verify(provider, times(1)).fetchMarketStatus("US");
	}

	@Test
	void quoteRequestsClassifyAfterHoursWhenMarketStatusIsPostMarket() {
		when(provider.fetchQuote("AAPL")).thenReturn(baseQuote(Instant.parse("2026-01-15T22:30:00Z")));
		when(provider.fetchMarketStatus("US")).thenReturn(new MarketStatusSnapshot(
				"US",
				false,
				"post-market",
				"America/New_York",
				Instant.parse("2026-01-15T22:30:00Z")
		));

		StockQuote quote = marketDataService.getQuote("AAPL", "Apple Inc.");

		assertThat(quote.marketSession()).isEqualTo(MarketSessionState.AFTER_HOURS);
		assertThat(quote.tradingEnabled()).isFalse();
		verify(provider, times(1)).fetchMarketStatus("US");
	}

	@Test
	void quoteRequestsFallbackToStaleSnapshotWhenFreshCacheExpires() {
		marketDataService = createService(
				Duration.ZERO,
				Duration.ofMinutes(15),
				Duration.ofMinutes(5),
				Duration.ofDays(1),
				Duration.ofMinutes(5),
				Duration.ofMinutes(30),
				true,
				List.of(new MarketDataProperties.HomeSymbol("AAPL", "Apple"))
		);

		when(provider.fetchQuote("AAPL"))
				.thenReturn(baseQuote())
				.thenThrow(new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Provider unavailable"));
		when(provider.fetchMarketStatus("US")).thenReturn(new MarketStatusSnapshot(
				"US",
				true,
				"regular",
				"America/New_York",
				Instant.parse("2026-01-15T15:00:00Z")
		));

		StockQuote fresh = marketDataService.getQuote("AAPL", "Apple Inc.");
		StockQuote stale = marketDataService.getQuote("AAPL", "Apple Inc.");

		assertThat(fresh.stale()).isFalse();
		assertThat(stale.stale()).isTrue();
		assertThat(stale.currentPrice()).isEqualByComparingTo(fresh.currentPrice());
		verify(provider, times(2)).fetchQuote("AAPL");
	}

	@Test
	void historyRequestsFallbackToLastSeriesWhenFreshCacheExpires() {
		marketDataService = createService(
				Duration.ofSeconds(30),
				Duration.ofMinutes(15),
				Duration.ZERO,
				Duration.ofDays(1),
				Duration.ofMinutes(5),
				Duration.ofMinutes(30),
				true,
				List.of(new MarketDataProperties.HomeSymbol("AAPL", "Apple"))
		);
		StockPriceHistory response = historyResponse();

		when(provider.fetchPriceHistory("AAPL", StockHistoryRange.ONE_MONTH))
				.thenReturn(response)
				.thenThrow(new ExternalServiceException("MARKETDATA_UNAVAILABLE", "History unavailable"));

		StockPriceHistory fresh = marketDataService.getPriceHistory("AAPL", StockHistoryRange.ONE_MONTH);
		StockPriceHistory stale = marketDataService.getPriceHistory("AAPL", StockHistoryRange.ONE_MONTH);

		assertThat(fresh).isEqualTo(response);
		assertThat(stale).isEqualTo(response);
		verify(provider, times(2)).fetchPriceHistory("AAPL", StockHistoryRange.ONE_MONTH);
	}

	@Test
	void searchRequestsFallbackToLastResultsWhenFreshCacheExpires() {
		marketDataService = createService(
				Duration.ofSeconds(30),
				Duration.ofMinutes(15),
				Duration.ofMinutes(5),
				Duration.ofDays(1),
				Duration.ZERO,
				Duration.ofMinutes(30),
				true,
				List.of(new MarketDataProperties.HomeSymbol("AAPL", "Apple"))
		);

		when(provider.search("apple"))
				.thenReturn(List.of(new StockSearchResult("AAPL", "Apple Inc.", "Common Stock")))
				.thenThrow(new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Search unavailable"));

		var fresh = marketDataService.search("apple");
		var stale = marketDataService.search("apple");

		assertThat(fresh).hasSize(1);
		assertThat(stale).hasSize(1);
		assertThat(stale).isEqualTo(fresh);
		verify(provider, times(2)).search("apple");
	}

	@Test
	void homeMarketReturnsPartialQuotesWhenOneSymbolFails() {
		marketDataService = createService(
				Duration.ofSeconds(30),
				Duration.ofMinutes(15),
				Duration.ofMinutes(5),
				Duration.ofDays(1),
				Duration.ofMinutes(5),
				Duration.ofMinutes(30),
				true,
				List.of(
						new MarketDataProperties.HomeSymbol("AAPL", "Apple"),
						new MarketDataProperties.HomeSymbol("MSFT", "Microsoft")
				)
		);

		when(provider.fetchQuote("AAPL")).thenReturn(baseQuote());
		when(provider.fetchQuote("MSFT")).thenThrow(new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Quote unavailable"));
		when(provider.fetchMarketStatus("US")).thenReturn(new MarketStatusSnapshot(
				"US",
				true,
				"regular",
				"America/New_York",
				Instant.parse("2026-01-15T15:00:00Z")
		));

		HomeMarketResponse response = marketDataService.getHomeMarket();

		assertThat(response.quotes()).hasSize(1);
		assertThat(response.quotes().getFirst().symbol()).isEqualTo("AAPL");
		assertThat(response.degraded()).isTrue();
	}

	private MarketDataService createService(
			Duration quoteCacheTtl,
			Duration quoteStaleGraceTtl,
			Duration historyCacheTtl,
			Duration historyStaleGraceTtl,
			Duration searchCacheTtl,
			Duration searchStaleGraceTtl,
			boolean allowPartialHomeResults,
			List<MarketDataProperties.HomeSymbol> homeSymbols
	) {
		return new MarketDataService(providerRouter, new MarketDataProperties(
				MarketDataProperties.ProviderType.FINNHUB,
				Duration.ofSeconds(4),
				quoteCacheTtl,
				quoteStaleGraceTtl,
				historyCacheTtl,
				historyStaleGraceTtl,
				searchCacheTtl,
				searchStaleGraceTtl,
				allowPartialHomeResults,
				homeSymbols,
				new MarketDataProperties.FinnhubProperties("https://finnhub.io/api/v1", "test-key")
		), Clock.fixed(Instant.parse("2026-01-15T15:00:00Z"), java.time.ZoneOffset.UTC));
	}

	private StockPriceHistory historyResponse() {
		return new StockPriceHistory(
				"AAPL",
				StockHistoryRange.ONE_MONTH,
				"1d",
				Instant.parse("2026-01-01T00:00:00Z"),
				Instant.parse("2026-01-31T00:00:00Z"),
				List.of(
						new StockPriceBar(
								Instant.parse("2026-01-15T00:00:00Z"),
								new BigDecimal("100.0000"),
								new BigDecimal("103.0000"),
								new BigDecimal("99.0000"),
								new BigDecimal("102.0000"),
								1200345L
						)
				)
		);
	}

	private StockQuote baseQuote() {
		return baseQuote(Instant.parse("2026-01-15T15:00:00Z"));
	}

	private StockQuote baseQuote(Instant timestamp) {
		return new StockQuote(
				"AAPL",
				"Apple Inc.",
				new BigDecimal("198.2200"),
				new BigDecimal("1.5200"),
				new BigDecimal("0.77"),
				new BigDecimal("197.1000"),
				new BigDecimal("199.0000"),
				new BigDecimal("196.4000"),
				new BigDecimal("196.7000"),
				timestamp,
				false,
				MarketSessionState.CLOSED,
				false,
				"America/New_York"
		);
	}
}

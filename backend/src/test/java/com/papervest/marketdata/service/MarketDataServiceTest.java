package com.papervest.marketdata.service;

import com.papervest.marketdata.config.MarketDataProperties;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceBar;
import com.papervest.marketdata.model.StockPriceHistory;
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
		marketDataService = new MarketDataService(providerRouter, new MarketDataProperties(
				MarketDataProperties.ProviderType.FINNHUB,
				Duration.ofSeconds(4),
				Duration.ofSeconds(30),
				Duration.ofMinutes(5),
				Duration.ofMinutes(5),
				List.of(new MarketDataProperties.HomeSymbol("AAPL", "Apple")),
				new MarketDataProperties.FinnhubProperties("https://finnhub.io/api/v1", "test-key")
		), Clock.fixed(Instant.parse("2026-01-15T15:00:00Z"), java.time.ZoneOffset.UTC));
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
}

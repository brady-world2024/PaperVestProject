package com.papervest.marketdata.provider;

import com.papervest.marketdata.config.MarketDataProperties;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceHistory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StooqHistoryClientTest {

	@Mock
	private HttpClient httpClient;

	@Mock
	private HttpResponse<String> response;

	private StooqHistoryClient client;

	@BeforeEach
	void setUp() {
		client = new StooqHistoryClient(httpClient, new MarketDataProperties(
				MarketDataProperties.ProviderType.FINNHUB,
				Duration.ofSeconds(4),
				Duration.ofSeconds(30),
				Duration.ofMinutes(5),
				Duration.ofMinutes(5),
				List.of(new MarketDataProperties.HomeSymbol("AAPL", "Apple")),
				new MarketDataProperties.FinnhubProperties("https://finnhub.io/api/v1", "test-key")
		));
	}

	@Test
	void oneMonthHistoryUsesRecentDailyBars() throws Exception {
		when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
		when(response.statusCode()).thenReturn(200);
		when(response.body()).thenReturn("""
				Date,Open,High,Low,Close,Volume
				2026-03-20,247.975,249.1999,246,247.99,88331081
				2026-03-23,253.97,254.6,250.28,251.49,40546109
				2026-03-24,250.35,254.825,249.55,251.64,45152288
				""");

		StockPriceHistory history = client.fetchPriceHistory("AAPL", StockHistoryRange.ONE_MONTH);

		assertThat(history.interval()).isEqualTo("1d");
		assertThat(history.points()).hasSize(3);
		assertThat(history.points().get(0).closePrice().toPlainString()).isEqualTo("247.9900");
		assertThat(history.points().get(2).closePrice().toPlainString()).isEqualTo("251.6400");
	}

	@Test
	void oneYearHistoryAggregatesDailyBarsIntoWeeklySeries() throws Exception {
		when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
		when(response.statusCode()).thenReturn(200);
		when(response.body()).thenReturn("""
				Date,Open,High,Low,Close,Volume
				2026-03-16,252.105,253.885,249.88,252.82,32074210
				2026-03-17,252.955,255.13,252.18,254.23,32361607
				2026-03-18,252.625,254.94,249,249.94,35757874
				2026-03-19,249.4,251.83,247.3,248.96,34864082
				2026-03-20,247.975,249.1999,246,247.99,88331081
				2026-03-23,253.97,254.6,250.28,251.49,40546109
				2026-03-24,250.35,254.825,249.55,251.64,45152288
				""");

		StockPriceHistory history = client.fetchPriceHistory("AAPL", StockHistoryRange.ONE_YEAR);

		assertThat(history.interval()).isEqualTo("1w");
		assertThat(history.points()).hasSize(2);
		assertThat(history.points().get(0).openPrice().toPlainString()).isEqualTo("252.1050");
		assertThat(history.points().get(0).closePrice().toPlainString()).isEqualTo("247.9900");
		assertThat(history.points().get(1).highPrice().toPlainString()).isEqualTo("254.8250");
	}
}

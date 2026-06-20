package com.papervest.marketdata.provider;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NasdaqHistoryClientTest {

	@Mock
	private HttpClient httpClient;

	@Mock
	private HttpResponse<String> response;

	private NasdaqHistoryClient client;

	@BeforeEach
	void setUp() {
		client = new NasdaqHistoryClient(
				httpClient,
				new ObjectMapper(),
				Clock.fixed(Instant.parse("2026-03-31T00:00:00Z"), ZoneOffset.UTC),
				new MarketDataProperties(
						MarketDataProperties.ProviderType.FINNHUB,
						Duration.ofSeconds(4),
						Duration.ofSeconds(30),
						Duration.ofMinutes(15),
						Duration.ofMinutes(5),
						Duration.ofDays(1),
						Duration.ofMinutes(5),
						Duration.ofMinutes(30),
						true,
						List.of(new MarketDataProperties.HomeSymbol("AAPL", "Apple")),
						new MarketDataProperties.FinnhubProperties("https://finnhub.io/api/v1", "test-key")
				)
		);
	}

	@Test
	void oneMonthHistoryUsesDailyRowsFromNasdaqHistoricalEndpoint() throws Exception {
		when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
		when(response.statusCode()).thenReturn(200);
		when(response.body()).thenReturn("""
				{
				  "data": {
				    "tradesTable": {
				      "rows": [
				        {"date":"03/30/2026","close":"$246.63","volume":"39,446,210","open":"$250.07","high":"$250.87","low":"$245.51"},
				        {"date":"03/27/2026","close":"$248.80","volume":"47,900,000","open":"$253.90","high":"$255.493","low":"$248.07"},
				        {"date":"03/26/2026","close":"$252.89","volume":"41,796,650","open":"$252.115","high":"$257.00","low":"$250.77"}
				      ]
				    }
				  },
				  "status": {"rCode": 200}
				}
				""");

		StockPriceHistory history = client.fetchPriceHistory("AAPL", StockHistoryRange.ONE_MONTH);

		assertThat(history.interval()).isEqualTo("1d");
		assertThat(history.points()).hasSize(3);
		assertThat(history.points().get(0).closePrice().toPlainString()).isEqualTo("252.8900");
		assertThat(history.points().get(2).closePrice().toPlainString()).isEqualTo("246.6300");
	}

	@Test
	void oneDayHistoryUsesIntradayNasdaqChartSeries() throws Exception {
		when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
		when(response.statusCode()).thenReturn(200);
		when(response.body()).thenReturn("""
				{
				  "data": {
				    "chart": [
				      {"x": 1774929600000, "y": "248.01"},
				      {"x": 1774929660000, "y": "248.19"},
				      {"x": 1774929720000, "y": "247.92"}
				    ]
				  },
				  "status": {"rCode": 200}
				}
				""");

		StockPriceHistory history = client.fetchPriceHistory("AAPL", StockHistoryRange.ONE_DAY);

		assertThat(history.interval()).isEqualTo("1m");
		assertThat(history.points()).hasSize(3);
		assertThat(history.points().get(0).closePrice().toPlainString()).isEqualTo("248.0100");
		assertThat(history.points().get(2).closePrice().toPlainString()).isEqualTo("247.9200");
	}
}

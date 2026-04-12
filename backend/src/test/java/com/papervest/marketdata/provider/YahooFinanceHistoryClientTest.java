package com.papervest.marketdata.provider;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class YahooFinanceHistoryClientTest {

	@Mock
	private HttpClient httpClient;

	@Mock
	private HttpResponse<String> response;

	private YahooFinanceHistoryClient client;

	@BeforeEach
	void setUp() {
		client = new YahooFinanceHistoryClient(httpClient, new ObjectMapper());
	}

	@Test
	void oneMonthHistoryBuildsDailySeriesFromYahooChartResponse() throws Exception {
		when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
		when(response.statusCode()).thenReturn(200);
		when(response.body()).thenReturn("""
				{
				  "chart": {
				    "result": [
				      {
				        "timestamp": [1772461800, 1772548200, 1772634600],
				        "indicators": {
				          "quote": [
				            {
				              "open": [262.41, 263.48, 264.65],
				              "high": [266.53, 265.56, 266.15],
				              "low": [260.20, 260.13, 261.42],
				              "close": [264.72, 263.75, 262.52],
				              "volume": [41827900, 38568900, 39803100]
				            }
				          ]
				        }
				      }
				    ]
				  }
				}
				""");

		StockPriceHistory history = client.fetchPriceHistory("AAPL", StockHistoryRange.ONE_MONTH);

		assertThat(history.symbol()).isEqualTo("AAPL");
		assertThat(history.range()).isEqualTo(StockHistoryRange.ONE_MONTH);
		assertThat(history.interval()).isEqualTo("1d");
		assertThat(history.points()).hasSize(3);
		assertThat(history.points().get(0).closePrice().toPlainString()).isEqualTo("264.7200");
		assertThat(history.points().get(2).closePrice().toPlainString()).isEqualTo("262.5200");
	}
}

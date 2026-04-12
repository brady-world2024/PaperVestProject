package com.papervest.marketdata.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.exception.ExternalServiceException;
import com.papervest.common.exception.RateLimitExceededException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.MoneyUtils;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceBar;
import com.papervest.marketdata.model.StockPriceHistory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

@Component
public class YahooFinanceHistoryClient {

	private static final Logger log = LoggerFactory.getLogger(YahooFinanceHistoryClient.class);
	private static final String BASE_URL = "https://query2.finance.yahoo.com/v8/finance/chart";
	private static final int MAX_ERROR_BODY_LOG_LENGTH = 400;

	private final HttpClient httpClient;
	private final ObjectMapper objectMapper;

	public YahooFinanceHistoryClient(HttpClient httpClient, ObjectMapper objectMapper) {
		this.httpClient = httpClient;
		this.objectMapper = objectMapper;
	}

	public StockPriceHistory fetchPriceHistory(String symbol, StockHistoryRange range) {
		RequestSpec requestSpec = requestSpec(range);
		Map<String, String> queryParameters = new LinkedHashMap<>();
		queryParameters.put("range", requestSpec.range());
		queryParameters.put("interval", requestSpec.interval());
		queryParameters.put("includePrePost", "false");
		queryParameters.put("events", "div,splits");

		HttpRequest request = HttpRequest.newBuilder(buildUri(symbol, queryParameters))
				.header("Accept", "application/json")
				.header("Origin", "https://finance.yahoo.com")
				.header("Referer", "https://finance.yahoo.com/")
				.header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36")
				.GET()
				.build();

		try {
			HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() == 429) {
				throw new RateLimitExceededException("Historical market data rate limit has been reached");
			}
			if (response.statusCode() < 200 || response.statusCode() >= 300) {
				log.warn(
						"Yahoo Finance history request failed symbol={} range={} status={} body={}",
						symbol,
						range.value(),
						response.statusCode(),
						truncate(response.body())
				);
				throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data is unavailable right now");
			}

			JsonNode root = objectMapper.readTree(response.body());
			JsonNode result = root.path("chart").path("result");
			if (!result.isArray() || result.isEmpty()) {
				log.warn(
						"Yahoo Finance history payload missing result symbol={} range={} body={}",
						symbol,
						range.value(),
						truncate(response.body())
				);
				throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No historical data is available for symbol " + symbol);
			}

			JsonNode series = result.get(0);
			JsonNode timestamps = series.path("timestamp");
			JsonNode quoteNode = series.path("indicators").path("quote");
			JsonNode quote = quoteNode.isArray() && !quoteNode.isEmpty() ? quoteNode.get(0) : null;
			if (!timestamps.isArray() || quote == null) {
				throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data is unavailable right now");
			}

			List<StockPriceBar> points = IntStream.range(0, timestamps.size())
					.mapToObj(index -> toPriceBar(index, timestamps, quote))
					.filter(point -> point.timestamp() != null && point.closePrice().compareTo(BigDecimal.ZERO) > 0)
					.toList();

			Instant from = points.isEmpty() ? Instant.now() : points.get(0).timestamp();
			Instant to = points.isEmpty() ? Instant.now() : points.get(points.size() - 1).timestamp();

			return new StockPriceHistory(
					symbol,
					range,
					requestSpec.displayInterval(),
					from,
					to,
					points
			);
		}
		catch (IOException ex) {
			log.error(
					"Yahoo Finance history I/O failure symbol={} range={} exceptionType={} message={}",
					symbol,
					range.value(),
					ex.getClass().getSimpleName(),
					ex.getMessage()
			);
			throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data could not be reached");
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			log.error(
					"Yahoo Finance history interrupted symbol={} range={} exceptionType={} message={}",
					symbol,
					range.value(),
					ex.getClass().getSimpleName(),
					ex.getMessage()
			);
			throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data request was interrupted");
		}
	}

	private URI buildUri(String symbol, Map<String, String> queryParameters) {
		String query = queryParameters.entrySet()
				.stream()
				.map(entry -> entry.getKey() + "=" + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
				.reduce((left, right) -> left + "&" + right)
				.orElse("");

		return URI.create(BASE_URL + "/" + URLEncoder.encode(symbol, StandardCharsets.UTF_8) + "?" + query);
	}

	private RequestSpec requestSpec(StockHistoryRange range) {
		return switch (range) {
			case ONE_DAY -> new RequestSpec("1d", "15m", "15m");
			case ONE_WEEK -> new RequestSpec("5d", "60m", "1h");
			case ONE_MONTH -> new RequestSpec("1mo", "1d", "1d");
			case THREE_MONTHS -> new RequestSpec("3mo", "1d", "1d");
			case ONE_YEAR -> new RequestSpec("1y", "1wk", "1w");
		};
	}

	private StockPriceBar toPriceBar(int index, JsonNode timestamps, JsonNode quote) {
		long epochSeconds = arrayLong(timestamps, index);
		return new StockPriceBar(
				epochSeconds > 0 ? Instant.ofEpochSecond(epochSeconds) : null,
				MoneyUtils.scalePrice(arrayDecimal(quote.path("open"), index)),
				MoneyUtils.scalePrice(arrayDecimal(quote.path("high"), index)),
				MoneyUtils.scalePrice(arrayDecimal(quote.path("low"), index)),
				MoneyUtils.scalePrice(arrayDecimal(quote.path("close"), index)),
				arrayLong(quote.path("volume"), index)
		);
	}

	private BigDecimal arrayDecimal(JsonNode node, int index) {
		if (!node.isArray() || index < 0 || index >= node.size()) {
			return BigDecimal.ZERO;
		}
		JsonNode value = node.get(index);
		if (value == null || value.isNull()) {
			return BigDecimal.ZERO;
		}
		return value.decimalValue();
	}

	private long arrayLong(JsonNode node, int index) {
		if (!node.isArray() || index < 0 || index >= node.size()) {
			return 0L;
		}
		JsonNode value = node.get(index);
		if (value == null || value.isNull()) {
			return 0L;
		}
		return value.asLong(0L);
	}

	private String truncate(String value) {
		if (value == null) {
			return "";
		}
		if (value.length() <= MAX_ERROR_BODY_LOG_LENGTH) {
			return value;
		}
		return value.substring(0, MAX_ERROR_BODY_LOG_LENGTH) + "...";
	}

	private record RequestSpec(String range, String interval, String displayInterval) {
	}
}

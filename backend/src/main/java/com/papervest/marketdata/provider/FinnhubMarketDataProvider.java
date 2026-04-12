package com.papervest.marketdata.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.exception.ExternalServiceException;
import com.papervest.common.exception.RateLimitExceededException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.MoneyUtils;
import com.papervest.marketdata.config.MarketDataProperties;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceBar;
import com.papervest.marketdata.model.StockPriceHistory;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.model.StockSearchResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;
import java.util.stream.Collectors;

@Component
public class FinnhubMarketDataProvider implements MarketDataProvider {

	private static final Logger log = LoggerFactory.getLogger(FinnhubMarketDataProvider.class);
	private static final int MAX_ERROR_BODY_LOG_LENGTH = 400;

	private final HttpClient httpClient;
	private final ObjectMapper objectMapper;
	private final MarketDataProperties properties;
	private final Clock clock;
	private final YahooFinanceHistoryClient yahooFinanceHistoryClient;
	private final NasdaqHistoryClient nasdaqHistoryClient;
	private final StooqHistoryClient stooqHistoryClient;

	public FinnhubMarketDataProvider(
			HttpClient httpClient,
			ObjectMapper objectMapper,
			MarketDataProperties properties,
			Clock clock,
			YahooFinanceHistoryClient yahooFinanceHistoryClient,
			NasdaqHistoryClient nasdaqHistoryClient,
			StooqHistoryClient stooqHistoryClient
	) {
		this.httpClient = httpClient;
		this.objectMapper = objectMapper;
		this.properties = properties;
		this.clock = clock;
		this.yahooFinanceHistoryClient = yahooFinanceHistoryClient;
		this.nasdaqHistoryClient = nasdaqHistoryClient;
		this.stooqHistoryClient = stooqHistoryClient;

		log.info(
				"Market data provider configured provider={} baseUrl={} apiKeyPresent={} apiKeyLength={} apiKeyPlaceholder={} workingDirectory={}",
				providerType(),
				properties.finnhub().baseUrl(),
				hasApiKey(),
				apiKeyLength(),
				isPlaceholderApiKey(),
				System.getProperty("user.dir")
		);

		if (isMissingApiKey()) {
			log.warn(
					"Finnhub market data is missing a usable API key. Market endpoints will return HTTP 503 until FINNHUB_API_KEY is provided through backend/.env.development for local development."
			);
		}
	}

	@Override
	public MarketDataProperties.ProviderType providerType() {
		return MarketDataProperties.ProviderType.FINNHUB;
	}

	@Override
	public StockQuote fetchQuote(String symbol) {
		JsonNode response = execute("/quote", Map.of("symbol", symbol));
		BigDecimal currentPrice = decimal(response, "c");

		if (currentPrice.compareTo(BigDecimal.ZERO) <= 0) {
			throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No quote data is available for symbol " + symbol);
		}

		long epochSeconds = response.path("t").asLong(0L);
		Instant quoteTimestamp = epochSeconds > 0 ? Instant.ofEpochSecond(epochSeconds) : clock.instant();

		return new StockQuote(
				symbol,
				null,
				MoneyUtils.scalePrice(currentPrice),
				MoneyUtils.scalePrice(decimal(response, "d")),
				decimal(response, "dp").setScale(2, RoundingMode.HALF_UP),
				MoneyUtils.scalePrice(decimal(response, "o")),
				MoneyUtils.scalePrice(decimal(response, "h")),
				MoneyUtils.scalePrice(decimal(response, "l")),
				MoneyUtils.scalePrice(decimal(response, "pc")),
				quoteTimestamp,
				false
		);
	}

	@Override
	public StockPriceHistory fetchPriceHistory(String symbol, StockHistoryRange range) {
		HistoryRequestSpec requestSpec = historyRequestSpec(range);
		JsonNode response;
		try {
			response = execute(
					"/stock/candle",
					Map.of(
							"symbol", symbol,
							"resolution", requestSpec.providerResolution(),
							"from", String.valueOf(requestSpec.from().getEpochSecond()),
							"to", String.valueOf(requestSpec.to().getEpochSecond())
					)
			);
		}
		catch (HistoricalPriceAccessUnavailableException ex) {
			return fetchFallbackHistory(symbol, range, "Finnhub candle access is unavailable for the configured key");
		}
		catch (ExternalServiceException ex) {
			return fetchFallbackHistory(
					symbol,
					range,
					"Finnhub history request failed with " + ex.code() + ": " + ex.getMessage()
			);
		}

		String status = response.path("s").asText("");
		if ("no_data".equalsIgnoreCase(status)) {
			log.info(
					"Finnhub returned no chart data symbol={} range={} resolution={} from={} to={}",
					symbol,
					range.value(),
					requestSpec.providerResolution(),
					requestSpec.from(),
					requestSpec.to()
			);
			return new StockPriceHistory(
					symbol,
					range,
					requestSpec.intervalLabel(),
					requestSpec.from(),
					requestSpec.to(),
					List.of()
			);
		}

		JsonNode timestamps = response.path("t");
		JsonNode opens = response.path("o");
		JsonNode highs = response.path("h");
		JsonNode lows = response.path("l");
		JsonNode closes = response.path("c");
		JsonNode volumes = response.path("v");

		if (!timestamps.isArray() || !closes.isArray()) {
			log.warn(
					"Finnhub chart payload was missing the expected arrays symbol={} range={} resolution={} body={}",
					symbol,
					range.value(),
					requestSpec.providerResolution(),
					truncate(response.toString())
			);
			throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data is unavailable right now");
		}

		List<StockPriceBar> points = java.util.stream.IntStream.range(0, timestamps.size())
				.mapToObj(index -> toPriceBar(index, timestamps, opens, highs, lows, closes, volumes))
				.filter(point -> point.timestamp() != null && point.closePrice().compareTo(BigDecimal.ZERO) > 0)
				.toList();

		return new StockPriceHistory(
				symbol,
				range,
				requestSpec.intervalLabel(),
				requestSpec.from(),
				requestSpec.to(),
				points
		);
	}

	@Override
	public List<StockSearchResult> search(String query) {
		JsonNode response = execute("/search", Map.of("q", query));
		JsonNode results = response.path("result");
		if (!results.isArray()) {
			return List.of();
		}
		return StreamSupport.stream(results.spliterator(), false)
				.limit(12)
				.map(node -> new StockSearchResult(
						node.path("symbol").asText(),
						node.path("description").asText(node.path("displaySymbol").asText()),
						node.path("type").asText("stock")
				))
				.filter(result -> result.symbol() != null && !result.symbol().isBlank())
				.toList();
	}

	@Override
	public String resolveCompanyName(String symbol) {
		JsonNode response = execute("/stock/profile2", Map.of("symbol", symbol));
		String name = response.path("name").asText();
		if (name == null || name.isBlank()) {
			throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No company profile is available for symbol " + symbol);
		}
		return name;
	}

	private HistoryRequestSpec historyRequestSpec(StockHistoryRange range) {
		Instant now = clock.instant().truncatedTo(ChronoUnit.MINUTES);
		return switch (range) {
			case ONE_DAY -> new HistoryRequestSpec("15", "15m", now.minus(1, ChronoUnit.DAYS), now);
			case ONE_WEEK -> new HistoryRequestSpec("60", "1h", now.minus(7, ChronoUnit.DAYS), now);
			case ONE_MONTH -> new HistoryRequestSpec("D", "1d", now.minus(30, ChronoUnit.DAYS), now);
			case THREE_MONTHS -> new HistoryRequestSpec("D", "1d", now.minus(90, ChronoUnit.DAYS), now);
			case ONE_YEAR -> new HistoryRequestSpec("W", "1w", now.minus(365, ChronoUnit.DAYS), now);
		};
	}

	private StockPriceBar toPriceBar(
			int index,
			JsonNode timestamps,
			JsonNode opens,
			JsonNode highs,
			JsonNode lows,
			JsonNode closes,
			JsonNode volumes
	) {
		long epochSeconds = arrayLong(timestamps, index);
		Instant timestamp = epochSeconds > 0 ? Instant.ofEpochSecond(epochSeconds) : null;

		return new StockPriceBar(
				timestamp,
				MoneyUtils.scalePrice(arrayDecimal(opens, index)),
				MoneyUtils.scalePrice(arrayDecimal(highs, index)),
				MoneyUtils.scalePrice(arrayDecimal(lows, index)),
				MoneyUtils.scalePrice(arrayDecimal(closes, index)),
				arrayLong(volumes, index)
		);
	}

	private JsonNode execute(String path, Map<String, String> queryParameters) {
		if (isMissingApiKey()) {
			log.error(
					"Finnhub request blocked because API key is missing or still uses a placeholder. path={} query={} baseUrl={} apiKeyPresent={} apiKeyLength={} apiKeyPlaceholder={}",
					path,
					queryParameters,
					properties.finnhub().baseUrl(),
					hasApiKey(),
					apiKeyLength(),
					isPlaceholderApiKey()
			);
			throw new ExternalServiceException(
					"MARKETDATA_CONFIGURATION_ERROR",
					"Set FINNHUB_API_KEY to request live market data"
			);
		}

		Map<String, String> params = new LinkedHashMap<>(queryParameters);
		params.put("token", properties.finnhub().apiKey());

		HttpRequest request = HttpRequest.newBuilder(buildUri(path, params))
				.timeout(properties.requestTimeout())
				.header("Accept", "application/json")
				.GET()
				.build();
		long startedAt = System.currentTimeMillis();
		log.debug("Finnhub request started path={} query={} timeout={}", path, queryParameters, properties.requestTimeout());

		try {
			HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
			long durationMs = System.currentTimeMillis() - startedAt;
			if (response.statusCode() == 429) {
				log.warn(
						"Finnhub rate limit encountered path={} query={} status={} durationMs={} body={}",
						path,
						queryParameters,
						response.statusCode(),
						durationMs,
						truncate(response.body())
				);
				throw new RateLimitExceededException("The market data provider rate limit has been reached");
			}
			if (response.statusCode() < 200 || response.statusCode() >= 300) {
				if ("/stock/candle".equals(path) && response.statusCode() == 403 && bodyIndicatesAccessRestriction(response.body())) {
					throw new HistoricalPriceAccessUnavailableException();
				}
				log.warn(
						"Finnhub request failed path={} query={} status={} durationMs={} body={}",
						path,
						queryParameters,
						response.statusCode(),
						durationMs,
						truncate(response.body())
				);
				throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "The market data provider is unavailable right now");
			}
			log.debug(
					"Finnhub request completed path={} query={} status={} durationMs={}",
					path,
					queryParameters,
					response.statusCode(),
					durationMs
			);

			JsonNode body = objectMapper.readTree(response.body());
			if (body.hasNonNull("error")) {
				String errorMessage = body.path("error").asText("The market data provider returned an error");
				if ("/stock/candle".equals(path) && bodyIndicatesAccessRestriction(errorMessage)) {
					throw new HistoricalPriceAccessUnavailableException();
				}
				log.warn(
						"Finnhub returned an application error path={} query={} error={} durationMs={} body={}",
						path,
						queryParameters,
						errorMessage,
						durationMs,
						truncate(response.body())
				);
				if (errorMessage.toLowerCase().contains("limit")) {
					throw new RateLimitExceededException(errorMessage);
				}
				throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", errorMessage);
			}
			return body;
		}
		catch (IOException ex) {
			log.error(
					"Finnhub request I/O failure path={} query={} durationMs={} exceptionType={} message={}",
					path,
					queryParameters,
					System.currentTimeMillis() - startedAt,
					ex.getClass().getSimpleName(),
					ex.getMessage()
			);
			throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "The market data provider could not be reached");
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			log.error(
					"Finnhub request interrupted path={} query={} durationMs={} exceptionType={} message={}",
					path,
					queryParameters,
					System.currentTimeMillis() - startedAt,
					ex.getClass().getSimpleName(),
					ex.getMessage()
			);
			throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "The market data provider request was interrupted");
		}
	}

	private URI buildUri(String path, Map<String, String> queryParameters) {
		String query = queryParameters.entrySet()
				.stream()
				.map(entry -> entry.getKey() + "=" + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
				.collect(Collectors.joining("&"));

		return URI.create(properties.finnhub().baseUrl() + path + "?" + query);
	}

	private BigDecimal decimal(JsonNode node, String fieldName) {
		JsonNode value = node.path(fieldName);
		if (value.isMissingNode() || value.isNull()) {
			return BigDecimal.ZERO;
		}
		return value.decimalValue();
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

	private boolean isMissingApiKey() {
		return !hasApiKey() || isPlaceholderApiKey();
	}

	private boolean hasApiKey() {
		return properties.finnhub().apiKey() != null && !properties.finnhub().apiKey().isBlank();
	}

	private boolean isPlaceholderApiKey() {
		if (!hasApiKey()) {
			return false;
		}

		String normalizedValue = properties.finnhub().apiKey().trim().toLowerCase();
		return "demo".equals(normalizedValue)
				|| normalizedValue.startsWith("replace-with")
				|| normalizedValue.contains("your-finnhub-api-key");
	}

	private int apiKeyLength() {
		return hasApiKey() ? properties.finnhub().apiKey().trim().length() : 0;
	}

	private boolean bodyIndicatesAccessRestriction(String value) {
		if (value == null || value.isBlank()) {
			return false;
		}
		String normalized = value.trim().toLowerCase();
		return normalized.contains("don't have access")
				|| normalized.contains("do not have access")
				|| normalized.contains("access to this resource");
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

	private record HistoryRequestSpec(
			String providerResolution,
			String intervalLabel,
			Instant from,
			Instant to
	) {
	}

	private StockPriceHistory fetchFallbackHistory(String symbol, StockHistoryRange range, String reason) {
		log.info(
				"Falling back to Yahoo Finance history for symbol={} range={} because {}",
				symbol,
				range.value(),
				reason
		);

		try {
			return yahooFinanceHistoryClient.fetchPriceHistory(symbol, range);
		}
		catch (ExternalServiceException | ResourceNotFoundException ex) {
			log.warn(
					"Yahoo Finance history fallback failed symbol={} range={} exceptionType={} message={}. Falling back to Nasdaq history.",
					symbol,
					range.value(),
					ex.getClass().getSimpleName(),
					ex.getMessage()
			);
		}

		try {
			return nasdaqHistoryClient.fetchPriceHistory(symbol, range);
		}
		catch (ExternalServiceException | ResourceNotFoundException ex) {
			log.warn(
					"Nasdaq history fallback failed symbol={} range={} exceptionType={} message={}. Falling back to Stooq daily history.",
					symbol,
					range.value(),
					ex.getClass().getSimpleName(),
					ex.getMessage()
			);
			return stooqHistoryClient.fetchPriceHistory(symbol, range);
		}
	}

	private static final class HistoricalPriceAccessUnavailableException extends RuntimeException {
		private static final long serialVersionUID = 1L;
	}
}

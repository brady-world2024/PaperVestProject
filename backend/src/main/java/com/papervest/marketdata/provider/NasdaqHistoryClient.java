package com.papervest.marketdata.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.exception.ExternalServiceException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.MoneyUtils;
import com.papervest.marketdata.config.MarketDataProperties;
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
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class NasdaqHistoryClient {

	private static final Logger log = LoggerFactory.getLogger(NasdaqHistoryClient.class);
	private static final String BASE_URL = "https://api.nasdaq.com/api/quote";
	private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy");
	private static final int MAX_ERROR_BODY_LOG_LENGTH = 400;

	private final HttpClient httpClient;
	private final ObjectMapper objectMapper;
	private final Clock clock;
	private final MarketDataProperties properties;

	public NasdaqHistoryClient(
			HttpClient httpClient,
			ObjectMapper objectMapper,
			Clock clock,
			MarketDataProperties properties
	) {
		this.httpClient = httpClient;
		this.objectMapper = objectMapper;
		this.clock = clock;
		this.properties = properties;
	}

	public StockPriceHistory fetchPriceHistory(String symbol, StockHistoryRange range) {
		return switch (range) {
			case ONE_DAY -> fetchIntradayHistory(symbol, range);
			case ONE_WEEK, ONE_MONTH, THREE_MONTHS -> fetchDailyHistory(symbol, range);
			case ONE_YEAR -> fetchWeeklyHistory(symbol, range);
		};
	}

	private StockPriceHistory fetchIntradayHistory(String symbol, StockHistoryRange range) {
		JsonNode root = execute(symbol, "chart", Map.of("assetclass", "stocks"));
		JsonNode data = root.path("data");
		JsonNode chart = data.path("chart");
		if (!chart.isArray() || chart.isEmpty()) {
			throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No historical data is available for symbol " + symbol);
		}

		List<StockPriceBar> points = new ArrayList<>();
		for (JsonNode point : chart) {
			long epochMillis = point.path("x").asLong(0L);
			BigDecimal closePrice = decimal(point.path("y").asText());
			if (epochMillis <= 0 || closePrice.compareTo(BigDecimal.ZERO) <= 0) {
				continue;
			}
			Instant timestamp = Instant.ofEpochMilli(epochMillis);
			BigDecimal price = MoneyUtils.scalePrice(closePrice);
			points.add(new StockPriceBar(timestamp, price, price, price, price, 0L));
		}

		if (points.isEmpty()) {
			throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No historical data is available for symbol " + symbol);
		}

		return new StockPriceHistory(
				symbol,
				range,
				"1m",
				points.get(0).timestamp(),
				points.get(points.size() - 1).timestamp(),
				points
		);
	}

	private StockPriceHistory fetchDailyHistory(String symbol, StockHistoryRange range) {
		List<DailyBar> dailyBars = fetchDailyBars(symbol, range);
		if (dailyBars.isEmpty()) {
			throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No historical data is available for symbol " + symbol);
		}

		List<StockPriceBar> points = dailyBars.stream()
				.map(this::toDailyPoint)
				.toList();

		return new StockPriceHistory(
				symbol,
				range,
				"1d",
				points.get(0).timestamp(),
				points.get(points.size() - 1).timestamp(),
				points
		);
	}

	private StockPriceHistory fetchWeeklyHistory(String symbol, StockHistoryRange range) {
		List<DailyBar> dailyBars = fetchDailyBars(symbol, range);
		if (dailyBars.isEmpty()) {
			throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No historical data is available for symbol " + symbol);
		}

		Map<LocalDate, List<DailyBar>> grouped = new LinkedHashMap<>();
		for (DailyBar bar : dailyBars) {
			LocalDate weekEnding = bar.date().with(TemporalAdjusters.nextOrSame(DayOfWeek.FRIDAY));
			grouped.computeIfAbsent(weekEnding, ignored -> new ArrayList<>()).add(bar);
		}

		List<StockPriceBar> points = grouped.entrySet()
				.stream()
				.map(entry -> {
					List<DailyBar> bars = entry.getValue();
					DailyBar first = bars.get(0);
					DailyBar last = bars.get(bars.size() - 1);
					BigDecimal high = bars.stream().map(DailyBar::highPrice).max(BigDecimal::compareTo).orElse(last.highPrice());
					BigDecimal low = bars.stream().map(DailyBar::lowPrice).min(BigDecimal::compareTo).orElse(last.lowPrice());
					long volume = bars.stream().mapToLong(DailyBar::volume).sum();
					return new StockPriceBar(
							entry.getKey().atStartOfDay().toInstant(ZoneOffset.UTC),
							MoneyUtils.scalePrice(first.openPrice()),
							MoneyUtils.scalePrice(high),
							MoneyUtils.scalePrice(low),
							MoneyUtils.scalePrice(last.closePrice()),
							volume
					);
				})
				.toList();

		return new StockPriceHistory(
				symbol,
				range,
				"1w",
				points.get(0).timestamp(),
				points.get(points.size() - 1).timestamp(),
				points
		);
	}

	private List<DailyBar> fetchDailyBars(String symbol, StockHistoryRange range) {
		RequestSpec requestSpec = requestSpec(range);
		JsonNode root = execute(
				symbol,
				"historical",
				Map.of(
						"assetclass", "stocks",
						"fromdate", requestSpec.fromDate().toString(),
						"limit", String.valueOf(requestSpec.limit())
				)
		);
		JsonNode rows = root.path("data").path("tradesTable").path("rows");
		if (!rows.isArray() || rows.isEmpty()) {
			throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No historical data is available for symbol " + symbol);
		}

		List<DailyBar> bars = new ArrayList<>();
		for (JsonNode row : rows) {
			String closeValue = row.path("close").asText();
			if (closeValue == null || closeValue.isBlank()) {
				continue;
			}
			LocalDate date = LocalDate.parse(row.path("date").asText(), DATE_FORMATTER);
			bars.add(new DailyBar(
					date,
					decimal(row.path("open").asText()),
					decimal(row.path("high").asText()),
					decimal(row.path("low").asText()),
					decimal(closeValue),
					longValue(row.path("volume").asText())
			));
		}

		bars.sort(java.util.Comparator.comparing(DailyBar::date));
		return bars;
	}

	private JsonNode execute(String symbol, String endpoint, Map<String, String> queryParameters) {
		HttpRequest request = HttpRequest.newBuilder(buildUri(symbol, endpoint, queryParameters))
				.timeout(properties.requestTimeout())
				.header("Accept", "application/json")
				.header("User-Agent", "Mozilla/5.0")
				.GET()
				.build();

		try {
			HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() < 200 || response.statusCode() >= 300) {
				log.warn(
						"Nasdaq history request failed symbol={} endpoint={} status={} body={}",
						symbol,
						endpoint,
						response.statusCode(),
						truncate(response.body())
				);
				throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data is unavailable right now");
			}

			JsonNode root = objectMapper.readTree(response.body());
			int responseCode = root.path("status").path("rCode").asInt(200);
			if (responseCode != 200) {
				String message = root.path("status").path("bCodeMessage").isArray()
						? root.path("status").path("bCodeMessage").get(0).path("errorMessage").asText("")
						: root.path("message").asText("");
				log.warn(
						"Nasdaq history payload reported an error symbol={} endpoint={} responseCode={} message={} body={}",
						symbol,
						endpoint,
						responseCode,
						message,
						truncate(response.body())
				);
				throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data is unavailable right now");
			}
			return root;
		}
		catch (IOException ex) {
			log.error(
					"Nasdaq history I/O failure symbol={} endpoint={} exceptionType={} message={}",
					symbol,
					endpoint,
					ex.getClass().getSimpleName(),
					ex.getMessage()
			);
			throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data could not be reached");
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			log.error(
					"Nasdaq history interrupted symbol={} endpoint={} exceptionType={} message={}",
					symbol,
					endpoint,
					ex.getClass().getSimpleName(),
					ex.getMessage()
			);
			throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data request was interrupted");
		}
	}

	private URI buildUri(String symbol, String endpoint, Map<String, String> queryParameters) {
		String query = queryParameters.entrySet()
				.stream()
				.map(entry -> entry.getKey() + "=" + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
				.collect(Collectors.joining("&"));
		return URI.create(BASE_URL + "/" + URLEncoder.encode(symbol, StandardCharsets.UTF_8) + "/" + endpoint + "?" + query);
	}

	private RequestSpec requestSpec(StockHistoryRange range) {
		LocalDate today = clock.instant().atZone(ZoneOffset.UTC).toLocalDate();
		return switch (range) {
			case ONE_DAY -> new RequestSpec(today.minusDays(2), 5);
			case ONE_WEEK -> new RequestSpec(today.minusDays(14), 10);
			case ONE_MONTH -> new RequestSpec(today.minusDays(45), 40);
			case THREE_MONTHS -> new RequestSpec(today.minusDays(120), 90);
			case ONE_YEAR -> new RequestSpec(today.minusDays(400), 320);
		};
	}

	private StockPriceBar toDailyPoint(DailyBar bar) {
		return new StockPriceBar(
				bar.date().atStartOfDay().toInstant(ZoneOffset.UTC),
				MoneyUtils.scalePrice(bar.openPrice()),
				MoneyUtils.scalePrice(bar.highPrice()),
				MoneyUtils.scalePrice(bar.lowPrice()),
				MoneyUtils.scalePrice(bar.closePrice()),
				bar.volume()
		);
	}

	private BigDecimal decimal(String rawValue) {
		if (rawValue == null || rawValue.isBlank() || "N/A".equalsIgnoreCase(rawValue)) {
			return BigDecimal.ZERO;
		}
		String normalized = rawValue.replace("$", "").replace(",", "").trim();
		if (normalized.isBlank()) {
			return BigDecimal.ZERO;
		}
		return new BigDecimal(normalized);
	}

	private long longValue(String rawValue) {
		if (rawValue == null || rawValue.isBlank() || "N/A".equalsIgnoreCase(rawValue)) {
			return 0L;
		}
		return Long.parseLong(rawValue.replace(",", "").trim());
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

	private record RequestSpec(LocalDate fromDate, int limit) {
	}

	private record DailyBar(
			LocalDate date,
			BigDecimal openPrice,
			BigDecimal highPrice,
			BigDecimal lowPrice,
			BigDecimal closePrice,
			long volume
	) {
	}
}

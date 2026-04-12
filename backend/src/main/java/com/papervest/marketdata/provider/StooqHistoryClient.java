package com.papervest.marketdata.provider;

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
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class StooqHistoryClient {

	private static final Logger log = LoggerFactory.getLogger(StooqHistoryClient.class);
	private static final String BASE_URL = "https://stooq.com/q/d/l/";
	private static final int MAX_ERROR_BODY_LOG_LENGTH = 400;

	private final HttpClient httpClient;
	private final MarketDataProperties properties;

	public StooqHistoryClient(HttpClient httpClient, MarketDataProperties properties) {
		this.httpClient = httpClient;
		this.properties = properties;
	}

	public StockPriceHistory fetchPriceHistory(String symbol, StockHistoryRange range) {
		HttpRequest request = HttpRequest.newBuilder(buildUri(symbol))
				.timeout(properties.requestTimeout())
				.header("Accept", "text/plain")
				.header("User-Agent", "PaperVest/1.0")
				.GET()
				.build();

		try {
			HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() < 200 || response.statusCode() >= 300) {
				log.warn(
						"Stooq history request failed symbol={} range={} status={} body={}",
						symbol,
						range.value(),
						response.statusCode(),
						truncate(response.body())
				);
				throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data is unavailable right now");
			}

			List<DailyBar> dailyBars = parseCsv(symbol, response.body());
			if (dailyBars.isEmpty()) {
				throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No historical data is available for symbol " + symbol);
			}

			List<StockPriceBar> points = switch (range) {
				case ONE_DAY -> toDailyPoints(lastBars(dailyBars, 1));
				case ONE_WEEK -> toDailyPoints(lastBars(dailyBars, 5));
				case ONE_MONTH -> toDailyPoints(lastBars(dailyBars, 22));
				case THREE_MONTHS -> toDailyPoints(lastBars(dailyBars, 66));
				case ONE_YEAR -> toWeeklyPoints(lastBars(dailyBars, 260));
			};

			if (points.isEmpty()) {
				throw new ResourceNotFoundException("STOCK_NOT_FOUND", "No historical data is available for symbol " + symbol);
			}

			return new StockPriceHistory(
					symbol,
					range,
					range == StockHistoryRange.ONE_YEAR ? "1w" : "1d",
					points.get(0).timestamp(),
					points.get(points.size() - 1).timestamp(),
					points
			);
		}
		catch (IOException ex) {
			log.error(
					"Stooq history I/O failure symbol={} range={} exceptionType={} message={}",
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
					"Stooq history interrupted symbol={} range={} exceptionType={} message={}",
					symbol,
					range.value(),
					ex.getClass().getSimpleName(),
					ex.getMessage()
			);
			throw new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Historical market data request was interrupted");
		}
	}

	private URI buildUri(String symbol) {
		Map<String, String> queryParameters = new LinkedHashMap<>();
		queryParameters.put("s", normalizeSymbol(symbol));
		queryParameters.put("i", "d");
		String query = queryParameters.entrySet()
				.stream()
				.map(entry -> entry.getKey() + "=" + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
				.collect(Collectors.joining("&"));
		return URI.create(BASE_URL + "?" + query);
	}

	private String normalizeSymbol(String symbol) {
		String normalized = symbol == null ? "" : symbol.trim().toLowerCase();
		if (normalized.endsWith(".us")) {
			return normalized;
		}
		return normalized + ".us";
	}

	private List<DailyBar> parseCsv(String symbol, String body) {
		if (body == null || body.isBlank() || body.contains("No data") || body.contains("Warning:")) {
			log.warn(
					"Stooq history payload contained no usable data symbol={} body={}",
					symbol,
					truncate(body)
			);
			return List.of();
		}

		String[] lines = body.split("\\R");
		List<DailyBar> bars = new ArrayList<>();
		for (int index = 1; index < lines.length; index++) {
			String line = lines[index].trim();
			if (line.isBlank()) {
				continue;
			}
			String[] columns = line.split(",");
			if (columns.length < 6) {
				continue;
			}

			LocalDate date = LocalDate.parse(columns[0]);
			BigDecimal open = new BigDecimal(columns[1]);
			BigDecimal high = new BigDecimal(columns[2]);
			BigDecimal low = new BigDecimal(columns[3]);
			BigDecimal close = new BigDecimal(columns[4]);
			long volume = Long.parseLong(columns[5]);
			bars.add(new DailyBar(date, open, high, low, close, volume));
		}
		return bars;
	}

	private List<DailyBar> lastBars(List<DailyBar> bars, int count) {
		if (bars.isEmpty()) {
			return List.of();
		}
		int fromIndex = Math.max(bars.size() - count, 0);
		return bars.subList(fromIndex, bars.size());
	}

	private List<StockPriceBar> toDailyPoints(List<DailyBar> bars) {
		return bars.stream()
				.map(bar -> new StockPriceBar(
						bar.date().atStartOfDay().toInstant(ZoneOffset.UTC),
						MoneyUtils.scalePrice(bar.openPrice()),
						MoneyUtils.scalePrice(bar.highPrice()),
						MoneyUtils.scalePrice(bar.lowPrice()),
						MoneyUtils.scalePrice(bar.closePrice()),
						bar.volume()
				))
				.toList();
	}

	private List<StockPriceBar> toWeeklyPoints(List<DailyBar> dailyBars) {
		Map<LocalDate, List<DailyBar>> grouped = new LinkedHashMap<>();
		for (DailyBar bar : dailyBars) {
			LocalDate weekEnding = bar.date().with(TemporalAdjusters.nextOrSame(DayOfWeek.FRIDAY));
			grouped.computeIfAbsent(weekEnding, ignored -> new ArrayList<>()).add(bar);
		}

		return grouped.entrySet()
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

package com.papervest.marketdata.provider;

import com.papervest.marketdata.config.MarketDataProperties;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.MarketStatusSnapshot;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceBar;
import com.papervest.marketdata.model.StockPriceHistory;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.model.StockSearchResult;
import com.papervest.testing.cismoke.CiSmokeState;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
@Profile("ci-smoke")
public class StaticMarketDataProvider implements MarketDataProvider {

	private static final Instant QUOTE_TIMESTAMP = Instant.parse("2026-01-02T15:30:00Z");
	private static final Instant HISTORY_FROM = Instant.parse("2025-12-01T00:00:00Z");
	private static final Instant HISTORY_TO = Instant.parse("2025-12-31T00:00:00Z");
	private static final Map<String, String> SYMBOLS = Map.of(
			"AAPL", "Apple Inc.",
			"MSFT", "Microsoft Corporation",
			"NVDA", "NVIDIA Corporation",
			"AMZN", "Amazon.com, Inc."
	);
	private final CiSmokeState ciSmokeState;

	public StaticMarketDataProvider(CiSmokeState ciSmokeState) {
		this.ciSmokeState = ciSmokeState;
	}

	@Override
	public MarketDataProperties.ProviderType providerType() {
		return MarketDataProperties.ProviderType.STATIC;
	}

	@Override
	public StockQuote fetchQuote(String symbol) {
		String normalized = normalize(symbol);
		String companyName = resolveCompanyName(normalized);
		MarketSessionState marketSession = ciSmokeState.marketSession();
		BigDecimal basePrice = switch (normalized) {
			case "MSFT" -> new BigDecimal("412.5000");
			case "NVDA" -> new BigDecimal("132.2000");
			case "AMZN" -> new BigDecimal("185.4000");
			default -> new BigDecimal("198.2200");
		};

		return new StockQuote(
				normalized,
				companyName,
				basePrice,
				new BigDecimal("1.5200"),
				new BigDecimal("0.77"),
				basePrice.subtract(new BigDecimal("1.1000")),
				basePrice.add(new BigDecimal("0.7800")),
				basePrice.subtract(new BigDecimal("1.8200")),
				basePrice.subtract(new BigDecimal("1.5200")),
				QUOTE_TIMESTAMP,
				false,
				marketSession,
				marketSession == MarketSessionState.OPEN,
				"America/New_York"
		);
	}

	@Override
	public MarketStatusSnapshot fetchMarketStatus(String exchange) {
		MarketSessionState marketSession = ciSmokeState.marketSession();
		return new MarketStatusSnapshot(
				exchange == null || exchange.isBlank() ? "US" : exchange,
				marketSession == MarketSessionState.OPEN,
				switch (marketSession) {
					case PRE_MARKET -> "pre-market";
					case AFTER_HOURS -> "after-hours";
					case CLOSED -> "closed";
					case OPEN -> "regular";
				},
				"America/New_York",
				QUOTE_TIMESTAMP
		);
	}

	@Override
	public StockPriceHistory fetchPriceHistory(String symbol, StockHistoryRange range) {
		String normalized = normalize(symbol);
		return new StockPriceHistory(
				normalized,
				range,
				range == StockHistoryRange.ONE_DAY ? "5m" : "1d",
				HISTORY_FROM,
				HISTORY_TO,
				List.of(
						new StockPriceBar(
								Instant.parse("2025-12-10T00:00:00Z"),
								new BigDecimal("195.0000"),
								new BigDecimal("199.0000"),
								new BigDecimal("194.2000"),
								new BigDecimal("198.2200"),
								1200345L
						),
						new StockPriceBar(
								Instant.parse("2025-12-11T00:00:00Z"),
								new BigDecimal("198.2200"),
								new BigDecimal("200.4000"),
								new BigDecimal("197.6000"),
								new BigDecimal("199.4800"),
								1300567L
						)
				)
		);
	}

	@Override
	public List<StockSearchResult> search(String query) {
		String normalizedQuery = query == null ? "" : query.trim().toUpperCase(Locale.ROOT);
		return SYMBOLS.entrySet().stream()
				.filter(entry -> normalizedQuery.isBlank()
						|| entry.getKey().contains(normalizedQuery)
						|| entry.getValue().toUpperCase(Locale.ROOT).contains(normalizedQuery))
				.map(entry -> new StockSearchResult(entry.getKey(), entry.getValue(), "Common Stock"))
				.toList();
	}

	@Override
	public String resolveCompanyName(String symbol) {
		return SYMBOLS.getOrDefault(normalize(symbol), normalize(symbol));
	}

	private String normalize(String symbol) {
		return symbol == null ? "AAPL" : symbol.trim().toUpperCase(Locale.ROOT);
	}
}

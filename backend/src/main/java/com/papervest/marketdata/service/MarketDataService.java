package com.papervest.marketdata.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.papervest.common.exception.ApiException;
import com.papervest.common.util.SymbolUtils;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.MarketStatusSnapshot;
import com.papervest.marketdata.config.MarketDataProperties;
import com.papervest.marketdata.model.HomeMarketResponse;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceHistory;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.model.StockSearchResult;
import com.papervest.marketdata.provider.MarketDataProvider;
import com.papervest.marketdata.provider.MarketDataProviderRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

@Service
public class MarketDataService {

	private static final Logger log = LoggerFactory.getLogger(MarketDataService.class);
	private static final String US_EXCHANGE = "US";
	private static final String DEFAULT_MARKET_TIMEZONE = "America/New_York";
	private static final LocalTime PRE_MARKET_START = LocalTime.of(4, 0);
	private static final LocalTime REGULAR_MARKET_START = LocalTime.of(9, 30);
	private static final LocalTime REGULAR_MARKET_END = LocalTime.of(16, 0);
	private static final LocalTime AFTER_HOURS_END = LocalTime.of(20, 0);

	private final MarketDataProperties properties;
	private final MarketDataProvider activeProvider;
	private final Cache<String, StockQuote> quoteCache;
	private final Cache<String, StockPriceHistory> historyCache;
	private final Cache<String, List<StockSearchResult>> searchCache;
	private final Cache<String, MarketStatusSnapshot> marketStatusCache;
	private final Clock clock;

	public MarketDataService(MarketDataProviderRouter providerRouter, MarketDataProperties properties, Clock clock) {
		this.properties = properties;
		this.activeProvider = providerRouter.activeProvider();
		this.clock = clock;
		this.quoteCache = Caffeine.newBuilder()
				.expireAfterWrite(properties.quoteCacheTtl())
				.maximumSize(512)
				.build();
		this.historyCache = Caffeine.newBuilder()
				.expireAfterWrite(properties.historyCacheTtl())
				.maximumSize(256)
				.build();
		this.searchCache = Caffeine.newBuilder()
				.expireAfterWrite(properties.searchCacheTtl())
				.maximumSize(128)
				.build();
		this.marketStatusCache = Caffeine.newBuilder()
				.expireAfterWrite(properties.quoteCacheTtl())
				.maximumSize(8)
				.build();
		log.info(
				"Market data service initialized provider={} quoteCacheTtl={} historyCacheTtl={} searchCacheTtl={}",
				activeProvider.providerType(),
				properties.quoteCacheTtl(),
				properties.historyCacheTtl(),
				properties.searchCacheTtl()
		);
	}

	public HomeMarketResponse getHomeMarket() {
		List<StockQuote> quotes = properties.homeSymbols()
				.stream()
				.map(symbol -> getQuote(symbol.symbol(), symbol.companyName()))
				.toList();
		return new HomeMarketResponse(quotes);
	}

	public StockQuote getQuote(String symbol, String companyNameHint) {
		String normalizedSymbol = SymbolUtils.normalize(symbol);
		StockQuote cached = quoteCache.getIfPresent(normalizedSymbol);
		if (cached != null) {
			log.debug("Market data quote cache hit symbol={} provider={}", normalizedSymbol, activeProvider.providerType());
			return mergeCompanyName(cached, companyNameHint);
		}
		log.debug("Market data quote cache miss symbol={} provider={}", normalizedSymbol, activeProvider.providerType());

		try {
			StockQuote fetched = enrichQuote(activeProvider.fetchQuote(normalizedSymbol));
			StockQuote enriched = mergeCompanyName(fetched, companyNameHint);
			quoteCache.put(normalizedSymbol, enriched);
			return enriched;
		}
		catch (ApiException ex) {
			if (cached != null) {
				return mergeCompanyName(cached, companyNameHint).withStale(true);
			}
			throw ex;
		}
	}

	public List<StockQuote> getQuotes(List<QuoteRequest> quoteRequests) {
		return quoteRequests.stream()
				.map(request -> getQuote(request.symbol(), request.companyName()))
				.toList();
	}

	public StockPriceHistory getPriceHistory(String symbol, StockHistoryRange range) {
		String normalizedSymbol = SymbolUtils.normalize(symbol);
		String cacheKey = normalizedSymbol + ":" + range.value();
		StockPriceHistory cached = historyCache.getIfPresent(cacheKey);
		if (cached != null) {
			log.debug(
					"Market data history cache hit symbol={} range={} provider={}",
					normalizedSymbol,
					range.value(),
					activeProvider.providerType()
			);
			return cached;
		}
		log.debug(
				"Market data history cache miss symbol={} range={} provider={}",
				normalizedSymbol,
				range.value(),
				activeProvider.providerType()
		);

		try {
			StockPriceHistory fetched = activeProvider.fetchPriceHistory(normalizedSymbol, range);
			historyCache.put(cacheKey, fetched);
			return fetched;
		}
		catch (ApiException ex) {
			if (cached != null) {
				return cached;
			}
			throw ex;
		}
	}

	public List<StockSearchResult> search(String rawQuery) {
		String normalizedQuery = rawQuery == null ? "" : rawQuery.trim().toLowerCase();
		if (normalizedQuery.isBlank()) {
			return List.of();
		}

		List<StockSearchResult> cached = searchCache.getIfPresent(normalizedQuery);
		if (cached != null) {
			log.debug("Market data search cache hit query={} provider={}", normalizedQuery, activeProvider.providerType());
			return cached;
		}
		log.debug("Market data search cache miss query={} provider={}", normalizedQuery, activeProvider.providerType());

		try {
			List<StockSearchResult> results = activeProvider.search(rawQuery.trim());
			searchCache.put(normalizedQuery, results);
			return results;
		}
		catch (ApiException ex) {
			if (cached != null) {
				return cached;
			}
			throw ex;
		}
	}

	public String resolveCompanyName(String symbol, String companyNameHint) {
		if (companyNameHint != null && !companyNameHint.isBlank()) {
			return companyNameHint.trim();
		}

		String normalizedSymbol = SymbolUtils.normalize(symbol);
		for (MarketDataProperties.HomeSymbol homeSymbol : properties.homeSymbols()) {
			if (homeSymbol.symbol().equalsIgnoreCase(normalizedSymbol)) {
				return homeSymbol.companyName();
			}
		}

		try {
			return activeProvider.resolveCompanyName(normalizedSymbol);
		}
		catch (ApiException ex) {
			return normalizedSymbol;
		}
	}

	private StockQuote mergeCompanyName(StockQuote quote, String companyNameHint) {
		if (quote.companyName() != null && !quote.companyName().isBlank()) {
			return quote;
		}
		return quote.withCompanyName(resolveCompanyName(quote.symbol(), companyNameHint));
	}

	private StockQuote enrichQuote(StockQuote quote) {
		MarketStatusSnapshot marketStatus = getMarketStatus(US_EXCHANGE);
		String marketTimezone = marketStatus == null || marketStatus.timezone() == null || marketStatus.timezone().isBlank()
				? DEFAULT_MARKET_TIMEZONE
				: marketStatus.timezone();
		MarketSessionState marketSession = classifySession(quote.quoteTimestamp(), marketStatus, marketTimezone);
		return quote.withMarketContext(marketSession, marketSession == MarketSessionState.OPEN, marketTimezone);
	}

	private MarketStatusSnapshot getMarketStatus(String exchange) {
		MarketStatusSnapshot cached = marketStatusCache.getIfPresent(exchange);
		if (cached != null) {
			return cached;
		}

		MarketStatusSnapshot fetched = activeProvider.fetchMarketStatus(exchange);
		marketStatusCache.put(exchange, fetched);
		return fetched;
	}

	private MarketSessionState classifySession(
			Instant quoteTimestamp,
			MarketStatusSnapshot marketStatus,
			String timezone
	) {
		if (marketStatus == null) {
			return MarketSessionState.CLOSED;
		}

		String session = marketStatus.session() == null ? "" : marketStatus.session().trim().toLowerCase();
		if ("regular".equals(session) && marketStatus.open()) {
			return MarketSessionState.OPEN;
		}

		ZoneId zoneId = ZoneId.of(timezone);
		Instant statusInstant = marketStatus.statusTimestamp() == null ? clock.instant() : marketStatus.statusTimestamp();
		ZonedDateTime statusTime = statusInstant.atZone(zoneId);
		ZonedDateTime quoteTime = quoteTimestamp.atZone(zoneId);

		return switch (session) {
			case "pre-market" -> isQuoteWithinSessionWindow(
					quoteTime,
					statusTime,
					PRE_MARKET_START,
					REGULAR_MARKET_START
			) ? MarketSessionState.PRE_MARKET : MarketSessionState.CLOSED;
			case "post-market" -> isQuoteWithinSessionWindow(
					quoteTime,
					statusTime,
					REGULAR_MARKET_END,
					AFTER_HOURS_END
			) ? MarketSessionState.AFTER_HOURS : MarketSessionState.CLOSED;
			default -> MarketSessionState.CLOSED;
		};
	}

	private boolean isQuoteWithinSessionWindow(
			ZonedDateTime quoteTime,
			ZonedDateTime statusTime,
			LocalTime start,
			LocalTime end
	) {
		LocalDate statusDate = statusTime.toLocalDate();
		if (!quoteTime.toLocalDate().equals(statusDate)) {
			return false;
		}

		LocalTime quoteLocalTime = quoteTime.toLocalTime();
		return !quoteLocalTime.isBefore(start) && quoteLocalTime.isBefore(end);
	}

	public record QuoteRequest(String symbol, String companyName) {
	}
}

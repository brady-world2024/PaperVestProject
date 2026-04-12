package com.papervest.watchlist.service;

import com.papervest.common.exception.ConflictException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.SymbolUtils;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.watchlist.dto.AddWatchlistItemRequest;
import com.papervest.watchlist.dto.WatchlistItemResponse;
import com.papervest.watchlist.dto.WatchlistResponse;
import com.papervest.watchlist.model.WatchlistItem;
import com.papervest.watchlist.repository.WatchlistItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class WatchlistService {

	private static final Logger log = LoggerFactory.getLogger(WatchlistService.class);
	private final WatchlistItemRepository watchlistItemRepository;
	private final MarketDataService marketDataService;

	public WatchlistService(WatchlistItemRepository watchlistItemRepository, MarketDataService marketDataService) {
		this.watchlistItemRepository = watchlistItemRepository;
		this.marketDataService = marketDataService;
	}

	@Transactional(readOnly = true)
	public WatchlistResponse getWatchlist(UUID userId) {
		List<WatchlistItem> items = watchlistItemRepository.findByUserIdOrderByCreatedAtDesc(userId);
		Map<String, StockQuote> quoteBySymbol = new HashMap<>();
		marketDataService.getQuotes(
				items.stream()
						.map(item -> new MarketDataService.QuoteRequest(item.getSymbol(), item.getCompanyName()))
						.toList()
		).forEach(quote -> quoteBySymbol.put(quote.symbol(), quote));

		WatchlistResponse response = new WatchlistResponse(
				items.stream()
						.map(item -> toResponse(item, quoteBySymbol.get(item.getSymbol())))
						.toList()
		);
		log.debug("Watchlist loaded userId={} itemCount={}", userId, response.items().size());
		return response;
	}

	@Transactional
	public WatchlistItemResponse add(UUID userId, AddWatchlistItemRequest request) {
		String symbol = SymbolUtils.normalize(request.symbol());
		if (watchlistItemRepository.existsByUserIdAndSymbol(userId, symbol)) {
			log.warn("Watchlist add rejected userId={} symbol={} reason=item_already_exists", userId, symbol);
			throw new ConflictException("WATCHLIST_ITEM_EXISTS", "This symbol is already on the watchlist");
		}

		StockQuote quote = marketDataService.getQuote(symbol, request.companyName());
		WatchlistItem item = watchlistItemRepository.save(new WatchlistItem(userId, symbol, quote.companyName()));
		log.info("Watchlist item added userId={} symbol={} companyName={}", userId, symbol, quote.companyName());
		return toResponse(item, quote);
	}

	@Transactional
	public void remove(UUID userId, String symbol) {
		String normalizedSymbol = SymbolUtils.normalize(symbol);
		WatchlistItem item = watchlistItemRepository.findByUserIdAndSymbol(userId, normalizedSymbol)
				.orElseThrow(() -> {
					log.warn("Watchlist remove rejected userId={} symbol={} reason=item_not_found", userId, normalizedSymbol);
					return new ResourceNotFoundException("WATCHLIST_ITEM_NOT_FOUND", "Watchlist item could not be found");
				});
		watchlistItemRepository.delete(item);
		log.info("Watchlist item removed userId={} symbol={}", userId, item.getSymbol());
	}

	private WatchlistItemResponse toResponse(WatchlistItem item, StockQuote quote) {
		return new WatchlistItemResponse(
				item.getSymbol(),
				item.getCompanyName(),
				quote == null ? null : quote.currentPrice(),
				quote == null ? null : quote.dailyChange(),
				quote == null ? null : quote.dailyChangePercent(),
				quote != null && quote.stale(),
				item.getCreatedAt()
		);
	}
}

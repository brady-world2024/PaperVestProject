package com.papervest.marketdata.controller;

import com.papervest.common.exception.ApiException;
import com.papervest.marketdata.model.HomeMarketResponse;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceHistory;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.model.StockSearchResponse;
import com.papervest.marketdata.service.MarketDataService;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/market")
public class MarketDataController {

	private final MarketDataService marketDataService;

	public MarketDataController(MarketDataService marketDataService) {
		this.marketDataService = marketDataService;
	}

	@GetMapping("/home")
	public HomeMarketResponse getHomeMarket() {
		return marketDataService.getHomeMarket();
	}

	@GetMapping("/search")
	public StockSearchResponse searchStocks(@RequestParam("q") @Size(min = 1, max = 32) String query) {
		return new StockSearchResponse(marketDataService.search(query));
	}

	@GetMapping("/stocks/{symbol}")
	public StockQuote getStock(@PathVariable String symbol) {
		return marketDataService.getQuote(symbol, null);
	}

	@GetMapping("/stocks/{symbol}/history")
	public StockPriceHistory getStockHistory(
			@PathVariable String symbol,
			@RequestParam(name = "range", defaultValue = "1M") String rawRange
	) {
		StockHistoryRange range = StockHistoryRange.fromValue(rawRange)
				.orElseThrow(() -> new ApiException(
						HttpStatus.BAD_REQUEST,
						"INVALID_HISTORY_RANGE",
						"Supported chart ranges are 1D, 1W, 1M, 3M, and 1Y"
				));
		return marketDataService.getPriceHistory(symbol, range);
	}
}

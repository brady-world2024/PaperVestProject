package com.papervest.portfolio.service;

import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.MoneyUtils;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.portfolio.dto.HoldingResponse;
import com.papervest.portfolio.dto.PortfolioResponse;
import com.papervest.portfolio.dto.PortfolioSummaryResponse;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import com.papervest.trading.model.Holding;
import com.papervest.trading.repository.HoldingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PortfolioValuationService {

	private static final Logger log = LoggerFactory.getLogger(PortfolioValuationService.class);

	private final UserAccountRepository userAccountRepository;
	private final HoldingRepository holdingRepository;
	private final MarketDataService marketDataService;

	public PortfolioValuationService(
			UserAccountRepository userAccountRepository,
			HoldingRepository holdingRepository,
			MarketDataService marketDataService
	) {
		this.userAccountRepository = userAccountRepository;
		this.holdingRepository = holdingRepository;
		this.marketDataService = marketDataService;
	}

	@Transactional(readOnly = true)
	public PortfolioResponse getPortfolio(UUID userId) {
		UserAccount account = userAccountRepository.findByUserId(userId)
				.orElseThrow(() -> new ResourceNotFoundException("ACCOUNT_NOT_FOUND", "User portfolio account could not be found"));
		List<Holding> holdings = holdingRepository.findByUserIdOrderBySymbolAsc(userId);

		Map<String, StockQuote> quoteBySymbol = new HashMap<>();
		marketDataService.getQuotes(
				holdings.stream()
						.map(holding -> new MarketDataService.QuoteRequest(holding.getSymbol(), holding.getCompanyName()))
						.toList()
		).forEach(quote -> quoteBySymbol.put(quote.symbol(), quote));

		List<HoldingResponse> holdingResponses = holdings.stream()
				.map(holding -> toHoldingResponse(holding, quoteBySymbol.get(holding.getSymbol())))
				.toList();

		BigDecimal holdingsMarketValue = holdingResponses.stream()
				.map(HoldingResponse::marketValue)
				.reduce(BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE), BigDecimal::add);
		BigDecimal unrealizedPnl = holdingResponses.stream()
				.map(HoldingResponse::unrealizedPnl)
				.reduce(BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE), BigDecimal::add);
		BigDecimal dailyChange = holdingResponses.stream()
				.map(HoldingResponse::dailyChange)
				.reduce(BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE), BigDecimal::add);
		BigDecimal totalPortfolioValue = MoneyUtils.scaleMoney(account.getCashBalance().add(holdingsMarketValue));
		BigDecimal totalPnl = MoneyUtils.scaleMoney(account.getRealizedPnl().add(unrealizedPnl));
		BigDecimal totalReturnPercent = MoneyUtils.percent(totalPortfolioValue.subtract(account.getInitialCash()), account.getInitialCash());

		PortfolioSummaryResponse summary = new PortfolioSummaryResponse(
				account.getInitialCash(),
				account.getCashBalance(),
				account.getReservedCashBalance(),
				account.getAvailableCashBalance(),
				holdingsMarketValue,
				totalPortfolioValue,
				unrealizedPnl,
				account.getRealizedPnl(),
				totalPnl,
				totalReturnPercent,
				dailyChange
		);

		PortfolioResponse response = new PortfolioResponse(summary, holdingResponses);
		long staleHoldingCount = holdingResponses.stream().filter(HoldingResponse::staleQuote).count();
		log.debug(
				"Portfolio valuation loaded userId={} holdingCount={} staleHoldingCount={} totalValue={} unrealizedPnl={}",
				userId,
				holdingResponses.size(),
				staleHoldingCount,
				summary.totalPortfolioValue(),
				summary.unrealizedPnl()
		);
		return response;
	}

	private HoldingResponse toHoldingResponse(Holding holding, StockQuote quote) {
		BigDecimal currentPrice = quote == null ? BigDecimal.ZERO.setScale(MoneyUtils.PRICE_SCALE) : quote.currentPrice();
		BigDecimal costBasis = MoneyUtils.moneyProduct(holding.getAverageCost(), holding.getQuantity());
		BigDecimal marketValue = MoneyUtils.moneyProduct(currentPrice, holding.getQuantity());
		BigDecimal unrealizedPnl = MoneyUtils.scaleMoney(marketValue.subtract(costBasis));
		BigDecimal dailyChange = quote == null
				? BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE)
				: MoneyUtils.moneyProduct(quote.dailyChange(), holding.getQuantity());

		return new HoldingResponse(
				holding.getSymbol(),
				holding.getCompanyName(),
				holding.getQuantity(),
				holding.getReservedQuantity(),
				holding.getAvailableQuantity(),
				holding.getAverageCost(),
				currentPrice,
				costBasis,
				marketValue,
				unrealizedPnl,
				MoneyUtils.percent(unrealizedPnl, costBasis),
				dailyChange,
				quote != null && quote.stale(),
				quote == null ? null : quote.quoteTimestamp(),
				quote == null ? null : quote.marketSession(),
				quote != null && quote.tradingEnabled(),
				quote == null ? null : quote.marketTimezone()
		);
	}
}

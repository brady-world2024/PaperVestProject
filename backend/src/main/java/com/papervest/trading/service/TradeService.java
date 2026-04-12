package com.papervest.trading.service;

import com.papervest.common.exception.InsufficientFundsException;
import com.papervest.common.exception.InvalidTradeException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.MoneyUtils;
import com.papervest.common.util.SymbolUtils;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import com.papervest.trading.dto.TradeExecutionResponse;
import com.papervest.trading.dto.TradeHistoryResponse;
import com.papervest.trading.dto.TradeOrderRequest;
import com.papervest.trading.model.Holding;
import com.papervest.trading.model.Trade;
import com.papervest.trading.model.TradeSide;
import com.papervest.trading.repository.HoldingRepository;
import com.papervest.trading.repository.TradeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Service
public class TradeService {

	private static final Logger log = LoggerFactory.getLogger(TradeService.class);
	private final UserAccountRepository userAccountRepository;
	private final HoldingRepository holdingRepository;
	private final TradeRepository tradeRepository;
	private final MarketDataService marketDataService;
	private final TransactionTemplate transactionTemplate;

	public TradeService(
			UserAccountRepository userAccountRepository,
			HoldingRepository holdingRepository,
			TradeRepository tradeRepository,
			MarketDataService marketDataService,
			PlatformTransactionManager transactionManager
	) {
		this.userAccountRepository = userAccountRepository;
		this.holdingRepository = holdingRepository;
		this.tradeRepository = tradeRepository;
		this.marketDataService = marketDataService;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
	}

	public TradeExecutionResponse buy(UUID userId, TradeOrderRequest request, String idempotencyKey) {
		return executeTrade(userId, request, TradeSide.BUY, idempotencyKey, null, null);
	}

	public TradeExecutionResponse sell(UUID userId, TradeOrderRequest request, String idempotencyKey) {
		return executeTrade(userId, request, TradeSide.SELL, idempotencyKey, null, null);
	}

	public TradeExecutionResponse executeConditionalOrder(
			UUID userId,
			TradeOrderRequest request,
			TradeSide side,
			String executionKey,
			StockQuote executionQuote
	) {
		return executeTrade(userId, request, side, null, executionKey, executionQuote);
	}

	@Transactional(readOnly = true)
	public TradeHistoryResponse history(UUID userId) {
		TradeHistoryResponse response = new TradeHistoryResponse(
				tradeRepository.findTop200ByUserIdOrderByExecutedAtDesc(userId)
						.stream()
						.map(trade -> toResponse(trade, false))
						.toList()
		);
		log.debug("Trade history loaded userId={} tradeCount={}", userId, response.trades().size());
		return response;
	}

	private TradeExecutionResponse executeTrade(
			UUID userId,
			TradeOrderRequest request,
			TradeSide side,
			String idempotencyKey,
			String executionKey,
			StockQuote executionQuote
	) {
		String normalizedSymbol = SymbolUtils.normalize(request.symbol());
		String normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
		String normalizedExecutionKey = normalizeExecutionKey(executionKey);
		BigDecimal normalizedQuantity = MoneyUtils.scaleQuantity(request.quantity());
		log.info(
				"Trade request received userId={} side={} symbol={} quantity={} idempotencyKeyPresent={} executionKeyPresent={}",
				userId,
				side,
				normalizedSymbol,
				normalizedQuantity,
				normalizedIdempotencyKey != null,
				normalizedExecutionKey != null
		);

		if (normalizedQuantity.compareTo(BigDecimal.ZERO) <= 0) {
			log.warn(
					"Trade rejected userId={} side={} symbol={} reason=invalid_quantity quantity={}",
					userId,
					side,
					normalizedSymbol,
					normalizedQuantity
			);
			throw new InvalidTradeException("INVALID_QUANTITY", "Quantity must be greater than zero");
		}

		if (normalizedIdempotencyKey != null) {
			Optional<Trade> existingTrade = tradeRepository.findByUserIdAndIdempotencyKey(userId, normalizedIdempotencyKey);
			if (existingTrade.isPresent()) {
				log.info(
						"Trade idempotency replay userId={} side={} symbol={} tradeId={}",
						userId,
						side,
						normalizedSymbol,
						existingTrade.get().getId()
				);
				return toResponse(existingTrade.get(), true);
			}
		}

		if (normalizedExecutionKey != null) {
			Optional<Trade> existingTrade = tradeRepository.findByExecutionKey(normalizedExecutionKey);
			if (existingTrade.isPresent()) {
				log.info(
						"Trade execution replay userId={} side={} symbol={} tradeId={} executionKey={}",
						userId,
						side,
						normalizedSymbol,
						existingTrade.get().getId(),
						normalizedExecutionKey
				);
				return toResponse(existingTrade.get(), true);
			}
		}

		StockQuote quote = executionQuote == null
				? marketDataService.getQuote(normalizedSymbol, request.companyName())
				: executionQuote;

		return transactionTemplate.execute(status ->
				persistTrade(
						userId,
						normalizedSymbol,
						normalizedQuantity,
						normalizedIdempotencyKey,
						normalizedExecutionKey,
						side,
						quote
				)
		);
	}

	private TradeExecutionResponse persistTrade(
			UUID userId,
			String symbol,
			BigDecimal quantity,
			String idempotencyKey,
			String executionKey,
			TradeSide side,
			StockQuote quote
	) {
		if (idempotencyKey != null) {
			Optional<Trade> existingTrade = tradeRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
			if (existingTrade.isPresent()) {
				log.info(
						"Trade idempotency replay under lock userId={} side={} symbol={} tradeId={}",
						userId,
						side,
						symbol,
						existingTrade.get().getId()
				);
				return toResponse(existingTrade.get(), true);
			}
		}

		if (executionKey != null) {
			Optional<Trade> existingTrade = tradeRepository.findByExecutionKey(executionKey);
			if (existingTrade.isPresent()) {
				log.info(
						"Trade execution replay under lock userId={} side={} symbol={} tradeId={} executionKey={}",
						userId,
						side,
						symbol,
						existingTrade.get().getId(),
						executionKey
				);
				return toResponse(existingTrade.get(), true);
			}
		}

		UserAccount account = userAccountRepository.findByUserIdForUpdate(userId)
				.orElseThrow(() -> new ResourceNotFoundException("ACCOUNT_NOT_FOUND", "User portfolio account could not be found"));
		Holding holding = holdingRepository.findByUserIdAndSymbolForUpdate(userId, symbol).orElse(null);

		BigDecimal executedPrice = quote.currentPrice();
		BigDecimal grossAmount = MoneyUtils.moneyProduct(executedPrice, quantity);
		BigDecimal realizedPnl = BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE);
		String companyName = quote.companyName();

		if (side == TradeSide.BUY) {
			if (account.getCashBalance().compareTo(grossAmount) < 0) {
				log.warn(
						"Trade rejected userId={} side={} symbol={} reason=insufficient_funds requiredAmount={} cashBalance={}",
						userId,
						side,
						symbol,
						grossAmount,
						account.getCashBalance()
				);
				throw new InsufficientFundsException("You do not have enough virtual cash to place this order");
			}
			account.debit(grossAmount);
			if (holding == null) {
				holdingRepository.save(new Holding(userId, symbol, companyName, quantity, executedPrice));
			}
			else {
				holding.applyBuy(quantity, executedPrice, companyName);
			}
		}
		else {
			if (holding == null || holding.getQuantity().compareTo(quantity) < 0) {
				log.warn(
						"Trade rejected userId={} side={} symbol={} reason=insufficient_shares requestedQuantity={} availableQuantity={}",
						userId,
						side,
						symbol,
						quantity,
						holding == null ? BigDecimal.ZERO.setScale(MoneyUtils.QUANTITY_SCALE) : holding.getQuantity()
				);
				throw new InvalidTradeException("INSUFFICIENT_SHARES", "You cannot sell more shares than you currently own");
			}
			holding.applySell(quantity);
			account.credit(grossAmount);
			realizedPnl = MoneyUtils.scaleMoney(executedPrice.subtract(holding.getAverageCost()).multiply(quantity));
			account.addRealizedPnl(realizedPnl);

			if (holding.isClosed()) {
				holdingRepository.delete(holding);
			}
		}

		Trade trade = tradeRepository.save(new Trade(
				userId,
				symbol,
				companyName,
				side,
				quantity,
				executedPrice,
				grossAmount,
				realizedPnl,
				account.getCashBalance(),
				idempotencyKey,
				executionKey
		));
		log.info(
				"Trade executed tradeId={} userId={} side={} symbol={} quantity={} executedPrice={} grossAmount={} realizedPnl={} cashBalanceAfter={}",
				trade.getId(),
				userId,
				side,
				symbol,
				quantity,
				executedPrice,
				grossAmount,
				realizedPnl,
				account.getCashBalance()
		);

		return toResponse(trade, false);
	}

	private TradeExecutionResponse toResponse(Trade trade, boolean idempotentReplay) {
		return new TradeExecutionResponse(
				trade.getId(),
				trade.getSymbol(),
				trade.getCompanyName(),
				trade.getSide(),
				trade.getQuantity(),
				trade.getExecutedPrice(),
				trade.getGrossAmount(),
				trade.getRealizedPnl(),
				trade.getCashBalanceAfterTrade(),
				trade.getExecutedAt(),
				idempotentReplay
		);
	}

	private String normalizeIdempotencyKey(String idempotencyKey) {
		if (idempotencyKey == null || idempotencyKey.isBlank()) {
			return null;
		}
		String trimmed = idempotencyKey.trim();
		if (trimmed.length() > 120) {
			throw new InvalidTradeException("INVALID_IDEMPOTENCY_KEY", "Idempotency key is too long");
		}
		return trimmed;
	}

	private String normalizeExecutionKey(String executionKey) {
		if (executionKey == null || executionKey.isBlank()) {
			return null;
		}
		String trimmed = executionKey.trim();
		if (trimmed.length() > 160) {
			throw new InvalidTradeException("INVALID_EXECUTION_KEY", "Execution key is too long");
		}
		return trimmed;
	}
}

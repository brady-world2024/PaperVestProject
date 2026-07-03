package com.papervest.orders.service;

import com.papervest.analytics.model.ProductAnalyticsEventName;
import com.papervest.analytics.service.ProductAnalyticsService;
import com.papervest.common.exception.InsufficientFundsException;
import com.papervest.common.exception.InvalidTradeException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.MoneyUtils;
import com.papervest.common.util.SymbolUtils;
import com.papervest.ledger.service.LedgerService;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.orders.dto.OrderDetailResponse;
import com.papervest.orders.dto.OrderListResponse;
import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderSource;
import com.papervest.orders.model.OrderStatus;
import com.papervest.orders.model.OrderStatusEvent;
import com.papervest.orders.model.OrderTimeInForce;
import com.papervest.orders.model.OrderType;
import com.papervest.orders.repository.OrderRepository;
import com.papervest.orders.repository.OrderStatusEventRepository;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import com.papervest.portfolio.service.PortfolioHistoryService;
import com.papervest.trading.dto.TradeExecutionResponse;
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
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class OrderService {

	private static final Logger log = LoggerFactory.getLogger(OrderService.class);
	private final OrderRepository orderRepository;
	private final OrderStatusEventRepository orderStatusEventRepository;
	private final UserAccountRepository userAccountRepository;
	private final HoldingRepository holdingRepository;
	private final TradeRepository tradeRepository;
	private final MarketDataService marketDataService;
	private final LedgerService ledgerService;
	private final PortfolioHistoryService portfolioHistoryService;
	private final ProductAnalyticsService productAnalyticsService;
	private final TransactionTemplate transactionTemplate;

	public OrderService(
			OrderRepository orderRepository,
			OrderStatusEventRepository orderStatusEventRepository,
			UserAccountRepository userAccountRepository,
			HoldingRepository holdingRepository,
			TradeRepository tradeRepository,
			MarketDataService marketDataService,
			LedgerService ledgerService,
			PortfolioHistoryService portfolioHistoryService,
			ProductAnalyticsService productAnalyticsService,
			PlatformTransactionManager transactionManager
	) {
		this.orderRepository = orderRepository;
		this.orderStatusEventRepository = orderStatusEventRepository;
		this.userAccountRepository = userAccountRepository;
		this.holdingRepository = holdingRepository;
		this.tradeRepository = tradeRepository;
		this.marketDataService = marketDataService;
		this.ledgerService = ledgerService;
		this.portfolioHistoryService = portfolioHistoryService;
		this.productAnalyticsService = productAnalyticsService;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
	}

	public TradeExecutionResponse submitLegacyMarketOrder(
			UUID userId,
			TradeOrderRequest request,
			TradeSide side,
			String idempotencyKey
	) {
		String normalizedSymbol = SymbolUtils.normalize(request.symbol());
		BigDecimal normalizedQuantity = MoneyUtils.scaleQuantity(request.quantity());
		String normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);

		if (normalizedQuantity.compareTo(BigDecimal.ZERO) <= 0) {
			throw new InvalidTradeException("INVALID_QUANTITY", "Quantity must be greater than zero");
		}

		if (normalizedIdempotencyKey != null) {
			Optional<Order> existingOrder = orderRepository.findByUserIdAndIdempotencyKey(userId, normalizedIdempotencyKey);
			if (existingOrder.isPresent()) {
				return toTradeResponseForOrder(existingOrder.get(), true);
			}
		}

		StockQuote quote = marketDataService.getQuote(normalizedSymbol, request.companyName());
		validateTradingWindow(quote);

		return transactionTemplate.execute(status -> persistMarketOrder(
				userId,
				request,
				side,
				normalizedSymbol,
				normalizedQuantity,
				normalizedIdempotencyKey,
				quote
		));
	}

	@Transactional(readOnly = true)
	public OrderListResponse listOrders(UUID userId) {
		return OrderMapper.toListResponse(orderRepository.findTop200ByUserIdOrderByCreatedAtDesc(userId));
	}

	@Transactional(readOnly = true)
	public OrderDetailResponse getOrder(UUID userId, UUID orderId) {
		Order order = orderRepository.findByIdAndUserId(orderId, userId)
				.orElseThrow(() -> new ResourceNotFoundException("ORDER_NOT_FOUND", "Order could not be found"));
		return OrderMapper.toDetailResponse(order, orderStatusEventRepository.findByOrderIdOrderByCreatedAtAsc(orderId));
	}

	private TradeExecutionResponse persistMarketOrder(
			UUID userId,
			TradeOrderRequest request,
			TradeSide side,
			String normalizedSymbol,
			BigDecimal normalizedQuantity,
			String normalizedIdempotencyKey,
			StockQuote quote
	) {
		if (normalizedIdempotencyKey != null) {
			Optional<Order> existingOrder = orderRepository.findByUserIdAndIdempotencyKey(userId, normalizedIdempotencyKey);
			if (existingOrder.isPresent()) {
				return toTradeResponseForOrder(existingOrder.get(), true);
			}
		}

		Order order = orderRepository.save(new Order(
				userId,
				normalizedSymbol,
				quote.companyName(),
				side,
				OrderType.MARKET,
				OrderTimeInForce.IOC,
				OrderSource.USER,
				null,
				normalizedQuantity,
				null,
				null,
				normalizedIdempotencyKey
		));
		appendEvent(order.getId(), null, OrderStatus.CREATED, "ORDER_CREATED", "Order accepted for validation");

		UserAccount account = userAccountRepository.findByUserIdForUpdate(userId)
				.orElseThrow(() -> new ResourceNotFoundException("ACCOUNT_NOT_FOUND", "User portfolio account could not be found"));
		Holding holding = holdingRepository.findByUserIdAndSymbolForUpdate(userId, normalizedSymbol).orElse(null);

		BigDecimal executedPrice = quote.currentPrice();
		BigDecimal grossAmount = MoneyUtils.moneyProduct(executedPrice, normalizedQuantity);
		BigDecimal realizedPnl = BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE);
		String companyName = quote.companyName();

		OrderStatus previousStatus = order.accept();
		appendEvent(order.getId(), previousStatus, OrderStatus.ACCEPTED, "ORDER_ACCEPTED", "Market order validated");

		Holding ledgerHolding;
		BigDecimal quantityAfterSell = BigDecimal.ZERO.setScale(MoneyUtils.QUANTITY_SCALE);
		BigDecimal reservedQuantityAfterSell = BigDecimal.ZERO.setScale(MoneyUtils.QUANTITY_SCALE);

		if (side == TradeSide.BUY) {
			if (account.getAvailableCashBalance().compareTo(grossAmount) < 0) {
				throw new InsufficientFundsException("You do not have enough virtual cash to place this order");
			}
			account.debit(grossAmount);
			if (holding == null) {
				ledgerHolding = holdingRepository.save(new Holding(userId, normalizedSymbol, companyName, normalizedQuantity, executedPrice));
			}
			else {
				holding.applyBuy(normalizedQuantity, executedPrice, companyName);
				ledgerHolding = holding;
			}
		}
		else {
			if (holding == null || holding.getAvailableQuantity().compareTo(normalizedQuantity) < 0) {
				throw new InvalidTradeException("INSUFFICIENT_SHARES", "You cannot sell more shares than you currently own");
			}
			holding.applySell(normalizedQuantity);
			account.credit(grossAmount);
			realizedPnl = MoneyUtils.scaleMoney(executedPrice.subtract(holding.getAverageCost()).multiply(normalizedQuantity));
			account.addRealizedPnl(realizedPnl);
			quantityAfterSell = holding.getQuantity();
			reservedQuantityAfterSell = holding.getReservedQuantity();
			ledgerHolding = holding;
			if (holding.isClosed()) {
				holdingRepository.delete(holding);
			}
		}

		Trade trade = tradeRepository.save(new Trade(
				userId,
				normalizedSymbol,
				companyName,
				side,
				normalizedQuantity,
				executedPrice,
				grossAmount,
				realizedPnl,
				account.getCashBalance(),
				normalizedIdempotencyKey,
				null,
				order.getId()
		));

		if (side == TradeSide.BUY) {
			ledgerService.recordTradeCashDebit(userId, order.getId(), trade.getId(), grossAmount, account, order.getId() + ":cash");
			ledgerService.recordPositionBuy(userId, normalizedSymbol, order.getId(), trade.getId(), normalizedQuantity, ledgerHolding, order.getId() + ":position");
		}
		else {
			ledgerService.recordTradeCashCredit(userId, order.getId(), trade.getId(), grossAmount, account, order.getId() + ":cash");
			ledgerService.recordPositionSell(
					userId,
					normalizedSymbol,
					order.getId(),
					trade.getId(),
					normalizedQuantity,
					quantityAfterSell,
					reservedQuantityAfterSell,
					order.getId() + ":position"
			);
		}

		OrderStatus fillPreviousStatus = order.fill(normalizedQuantity, grossAmount);
		appendEvent(order.getId(), fillPreviousStatus, OrderStatus.FILLED, "ORDER_FILLED", "Market order filled immediately");

		log.info(
				"Order filled orderId={} tradeId={} userId={} side={} symbol={} quantity={} grossAmount={}",
				order.getId(),
				trade.getId(),
				userId,
				side,
				normalizedSymbol,
				normalizedQuantity,
				grossAmount
		);
		recordPortfolioSnapshotBestEffort(userId, trade.getExecutedAt());
		recordAnalyticsBestEffort(
				userId,
				ProductAnalyticsEventName.TRADE_EXECUTED,
				Map.of(
						"symbol", normalizedSymbol,
						"side", side.name(),
						"quantity", normalizedQuantity,
						"grossAmount", grossAmount,
						"orderId", order.getId()
				)
		);

		return toTradeResponse(trade, order, false);
	}

	private void appendEvent(
			UUID orderId,
			OrderStatus fromStatus,
			OrderStatus toStatus,
			String reasonCode,
			String reasonMessage
	) {
		orderStatusEventRepository.save(new OrderStatusEvent(
				orderId,
				fromStatus,
				toStatus,
				reasonCode,
				reasonMessage,
				null
		));
	}

	private void validateTradingWindow(StockQuote quote) {
		if (quote.tradingEnabled()) {
			return;
		}

		throw new InvalidTradeException(
				"MARKET_CLOSED",
				"Paper trading is only available during regular market hours"
		);
	}

	private TradeExecutionResponse toTradeResponseForOrder(Order order, boolean idempotentReplay) {
		Trade trade = tradeRepository.findTop1ByOrderId(order.getId())
				.orElseThrow(() -> new ResourceNotFoundException("TRADE_NOT_FOUND", "Order fill could not be found"));
		return toTradeResponse(trade, order, idempotentReplay);
	}

	private TradeExecutionResponse toTradeResponse(Trade trade, Order order, boolean idempotentReplay) {
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
				idempotentReplay,
				order.getId(),
				order.getStatus().name()
		);
	}

	private void recordPortfolioSnapshotBestEffort(UUID userId, Instant capturedAt) {
		try {
			portfolioHistoryService.recordTradeExecutionSnapshot(userId, capturedAt);
		}
		catch (RuntimeException ex) {
			log.warn(
					"Portfolio snapshot recording skipped userId={} capturedAt={} reason={}",
					userId,
					capturedAt,
					ex.getMessage()
			);
		}
	}

	private void recordAnalyticsBestEffort(UUID userId, ProductAnalyticsEventName eventName, Map<String, Object> metadata) {
		try {
			productAnalyticsService.trackDomainEvent(userId, eventName, metadata);
		}
		catch (RuntimeException ex) {
			log.warn(
					"Product analytics recording skipped userId={} event={} reason={}",
					userId,
					eventName,
					ex.getMessage()
			);
		}
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
}

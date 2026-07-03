package com.papervest.orders.execution.service;

import com.papervest.analytics.model.ProductAnalyticsEventName;
import com.papervest.analytics.service.ProductAnalyticsService;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.MoneyUtils;
import com.papervest.ledger.service.LedgerService;
import com.papervest.orders.execution.model.OrderExecutionRequest;
import com.papervest.orders.execution.model.OrderExecutionRequestStatus;
import com.papervest.orders.execution.repository.OrderExecutionRequestRepository;
import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderStatus;
import com.papervest.orders.model.OrderStatusEvent;
import com.papervest.orders.repository.OrderRepository;
import com.papervest.orders.repository.OrderStatusEventRepository;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import com.papervest.portfolio.service.PortfolioHistoryService;
import com.papervest.trading.model.Holding;
import com.papervest.trading.model.Trade;
import com.papervest.trading.model.TradeSide;
import com.papervest.trading.repository.HoldingRepository;
import com.papervest.trading.repository.TradeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class OrderExecutionService {

	private static final Logger log = LoggerFactory.getLogger(OrderExecutionService.class);

	private final OrderExecutionRequestRepository requestRepository;
	private final OrderRepository orderRepository;
	private final OrderStatusEventRepository orderStatusEventRepository;
	private final UserAccountRepository userAccountRepository;
	private final HoldingRepository holdingRepository;
	private final TradeRepository tradeRepository;
	private final LedgerService ledgerService;
	private final PortfolioHistoryService portfolioHistoryService;
	private final ProductAnalyticsService productAnalyticsService;

	public OrderExecutionService(
			OrderExecutionRequestRepository requestRepository,
			OrderRepository orderRepository,
			OrderStatusEventRepository orderStatusEventRepository,
			UserAccountRepository userAccountRepository,
			HoldingRepository holdingRepository,
			TradeRepository tradeRepository,
			LedgerService ledgerService,
			PortfolioHistoryService portfolioHistoryService,
			ProductAnalyticsService productAnalyticsService
	) {
		this.requestRepository = requestRepository;
		this.orderRepository = orderRepository;
		this.orderStatusEventRepository = orderStatusEventRepository;
		this.userAccountRepository = userAccountRepository;
		this.holdingRepository = holdingRepository;
		this.tradeRepository = tradeRepository;
		this.ledgerService = ledgerService;
		this.portfolioHistoryService = portfolioHistoryService;
		this.productAnalyticsService = productAnalyticsService;
	}

	@Transactional
	public void executeRequest(UUID requestId) {
		OrderExecutionRequest request = requestRepository.findByIdForUpdate(requestId)
				.orElseThrow(() -> new ResourceNotFoundException(
						"ORDER_EXECUTION_REQUEST_NOT_FOUND",
						"Order execution request could not be found"
				));
		if (request.getStatus() == OrderExecutionRequestStatus.CONSUMED
				|| request.getStatus() == OrderExecutionRequestStatus.CANCELLED) {
			return;
		}

		Order order = orderRepository.findByIdForUpdate(request.getOrderId())
				.orElseThrow(() -> new ResourceNotFoundException("ORDER_NOT_FOUND", "Order could not be found"));
		if (order.getStatus() != OrderStatus.PENDING) {
			request.markCancelled();
			return;
		}

		String executionKey = "order-execution-" + order.getId();
		Trade existingTrade = tradeRepository.findByExecutionKey(executionKey).orElse(null);
		if (existingTrade != null) {
			OrderStatus previousStatus = order.fill(order.getRequestedQuantity(), existingTrade.getGrossAmount());
			appendEvent(order.getId(), previousStatus, OrderStatus.FILLED, "ORDER_FILLED", "Order execution was already persisted");
			request.markConsumed();
			return;
		}

		Trade trade = fillOrder(order, request.getExecutionPrice(), executionKey);
		request.markConsumed();

		recordPortfolioSnapshotBestEffort(order.getUserId(), trade.getExecutedAt());
		recordAnalyticsBestEffort(
				order.getUserId(),
				ProductAnalyticsEventName.TRADE_EXECUTED,
				Map.of(
						"symbol", order.getSymbol(),
						"side", order.getSide().name(),
						"quantity", order.getRequestedQuantity(),
						"grossAmount", trade.getGrossAmount(),
						"orderId", order.getId()
				)
		);
		log.info("Order execution consumed requestId={} orderId={} tradeId={}", request.getId(), order.getId(), trade.getId());
	}

	private Trade fillOrder(Order order, BigDecimal executedPrice, String executionKey) {
		BigDecimal quantity = order.getRequestedQuantity();
		BigDecimal grossAmount = MoneyUtils.moneyProduct(executedPrice, quantity);
		BigDecimal realizedPnl = BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE);
		UserAccount account = userAccountRepository.findByUserIdForUpdate(order.getUserId())
				.orElseThrow(() -> new ResourceNotFoundException("ACCOUNT_NOT_FOUND", "User portfolio account could not be found"));

		Holding ledgerHolding;
		BigDecimal quantityAfterSell = BigDecimal.ZERO.setScale(MoneyUtils.QUANTITY_SCALE);
		BigDecimal reservedQuantityAfterSell = BigDecimal.ZERO.setScale(MoneyUtils.QUANTITY_SCALE);

		if (order.getSide() == TradeSide.BUY) {
			BigDecimal cashToRelease = order.getReservedCashAmount();
			if (cashToRelease.compareTo(BigDecimal.ZERO) > 0) {
				account.releaseReservedCash(cashToRelease);
				order.releaseReservedCash(cashToRelease);
				ledgerService.recordCashRelease(
						order.getUserId(),
						order.getId(),
						cashToRelease,
						account,
						order.getId() + ":cash-release-execution"
				);
			}
			account.debit(grossAmount);
			Holding holding = holdingRepository.findByUserIdAndSymbolForUpdate(order.getUserId(), order.getSymbol())
					.orElse(null);
			if (holding == null) {
				ledgerHolding = holdingRepository.save(new Holding(
						order.getUserId(),
						order.getSymbol(),
						order.getCompanyName(),
						quantity,
						executedPrice
				));
			}
			else {
				holding.applyBuy(quantity, executedPrice, order.getCompanyName());
				ledgerHolding = holding;
			}
		}
		else {
			Holding holding = holdingRepository.findByUserIdAndSymbolForUpdate(order.getUserId(), order.getSymbol())
					.orElseThrow(() -> new ResourceNotFoundException("HOLDING_NOT_FOUND", "Holding could not be found"));
			BigDecimal quantityToRelease = order.getReservedQuantity();
			if (quantityToRelease.compareTo(BigDecimal.ZERO) > 0) {
				holding.releaseReservedQuantity(quantityToRelease);
				order.releaseReservedQuantity(quantityToRelease);
				ledgerService.recordPositionRelease(
						order.getUserId(),
						order.getSymbol(),
						order.getId(),
						quantityToRelease,
						holding,
						order.getId() + ":position-release-execution"
				);
			}
			BigDecimal averageCost = holding.getAverageCost();
			holding.applySell(quantity);
			account.credit(grossAmount);
			realizedPnl = MoneyUtils.scaleMoney(executedPrice.subtract(averageCost).multiply(quantity));
			account.addRealizedPnl(realizedPnl);
			quantityAfterSell = holding.getQuantity();
			reservedQuantityAfterSell = holding.getReservedQuantity();
			ledgerHolding = holding;
			if (holding.isClosed()) {
				holdingRepository.delete(holding);
			}
		}

		Trade trade = tradeRepository.save(new Trade(
				order.getUserId(),
				order.getSymbol(),
				order.getCompanyName(),
				order.getSide(),
				quantity,
				executedPrice,
				grossAmount,
				realizedPnl,
				account.getCashBalance(),
				order.getIdempotencyKey(),
				executionKey,
				order.getId()
		));

		if (order.getSide() == TradeSide.BUY) {
			ledgerService.recordTradeCashDebit(order.getUserId(), order.getId(), trade.getId(), grossAmount, account, order.getId() + ":cash");
			ledgerService.recordPositionBuy(
					order.getUserId(),
					order.getSymbol(),
					order.getId(),
					trade.getId(),
					quantity,
					ledgerHolding,
					order.getId() + ":position"
			);
		}
		else {
			ledgerService.recordTradeCashCredit(order.getUserId(), order.getId(), trade.getId(), grossAmount, account, order.getId() + ":cash");
			ledgerService.recordPositionSell(
					order.getUserId(),
					order.getSymbol(),
					order.getId(),
					trade.getId(),
					quantity,
					quantityAfterSell,
					reservedQuantityAfterSell,
					order.getId() + ":position"
			);
		}

		OrderStatus previousStatus = order.fill(quantity, grossAmount);
		appendEvent(order.getId(), previousStatus, OrderStatus.FILLED, "ORDER_FILLED", "Pending order filled asynchronously");
		return trade;
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
}

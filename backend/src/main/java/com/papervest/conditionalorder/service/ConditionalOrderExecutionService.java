package com.papervest.conditionalorder.service;

import com.papervest.common.exception.ApiException;
import com.papervest.common.exception.ConflictException;
import com.papervest.common.exception.InsufficientFundsException;
import com.papervest.common.exception.InvalidTradeException;
import com.papervest.conditionalorder.config.ConditionalOrderProperties;
import com.papervest.conditionalorder.messaging.ConditionalOrderMessagePublisher;
import com.papervest.conditionalorder.model.ConditionalOrder;
import com.papervest.conditionalorder.model.ConditionalOrderFailureCode;
import com.papervest.conditionalorder.model.ConditionalOrderStatus;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.trading.dto.TradeExecutionResponse;
import com.papervest.trading.dto.TradeOrderRequest;
import com.papervest.trading.model.Trade;
import com.papervest.trading.repository.TradeRepository;
import com.papervest.trading.service.TradeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ConditionalOrderExecutionService {

	private static final Logger log = LoggerFactory.getLogger(ConditionalOrderExecutionService.class);

	private final ConditionalOrderProperties properties;
	private final ConditionalOrderService conditionalOrderService;
	private final ConditionalOrderTransitionService transitionService;
	private final MarketDataService marketDataService;
	private final ConditionalOrderMessagePublisher messagePublisher;
	private final TradeService tradeService;
	private final TradeRepository tradeRepository;
	private final Clock clock;

	public ConditionalOrderExecutionService(
			ConditionalOrderProperties properties,
			ConditionalOrderService conditionalOrderService,
			ConditionalOrderTransitionService transitionService,
			MarketDataService marketDataService,
			ConditionalOrderMessagePublisher messagePublisher,
			TradeService tradeService,
			TradeRepository tradeRepository,
			Clock clock
	) {
		this.properties = properties;
		this.conditionalOrderService = conditionalOrderService;
		this.transitionService = transitionService;
		this.marketDataService = marketDataService;
		this.messagePublisher = messagePublisher;
		this.tradeService = tradeService;
		this.tradeRepository = tradeRepository;
		this.clock = clock;
	}

	public void scanAndTriggerReadyOrders() {
		List<ConditionalOrder> activeOrders = conditionalOrderService.listActiveBatch(properties.scheduler().batchSize());
		if (activeOrders.isEmpty()) {
			log.debug("Conditional order scheduler scan completed activeCount=0");
			return;
		}

		log.info("Conditional order scheduler scan started activeCount={}", activeOrders.size());
		Instant now = clock.instant();
		Map<String, List<ConditionalOrder>> ordersBySymbol = activeOrders.stream()
				.collect(Collectors.groupingBy(ConditionalOrder::getSymbol, LinkedHashMap::new, Collectors.toList()));

		for (Map.Entry<String, List<ConditionalOrder>> entry : ordersBySymbol.entrySet()) {
			String symbol = entry.getKey();
			List<ConditionalOrder> orders = entry.getValue();
			StockQuote quote;

			try {
				quote = marketDataService.getQuote(symbol, null);
			}
			catch (ApiException ex) {
				log.warn(
						"Conditional order scheduler skipped symbol={} orderCount={} reason=market_data_unavailable code={} message={}",
						symbol,
						orders.size(),
						ex.code(),
						ex.getMessage()
				);
				continue;
			}

			log.info(
					"Conditional order scheduler evaluated symbol={} orderCount={} price={}",
					symbol,
					orders.size(),
					quote.currentPrice()
			);

			for (ConditionalOrder order : orders) {
				if (order.getExpiresAt() != null && !order.getExpiresAt().isAfter(now)) {
					boolean expired = transitionService.expire(order);
					if (expired) {
						log.info("Conditional order expired orderId={} symbol={}", order.getId(), order.getSymbol());
					}
					continue;
				}

				transitionService.touchLastCheckedPrice(order, quote.currentPrice());
				if (!priceConditionMet(order, quote.currentPrice())) {
					continue;
				}

				boolean triggered = transitionService.markTriggered(
						order,
						quote.currentPrice(),
						Map.of(
								"marketPrice", quote.currentPrice(),
								"targetPrice", order.getTargetPrice(),
								"checkedAt", now.toString()
						)
				);
				if (!triggered) {
					log.info("Conditional order trigger skipped orderId={} reason=state_conflict", order.getId());
					continue;
				}

				log.info(
						"Conditional order triggered orderId={} symbol={} side={} marketPrice={} targetPrice={}",
						order.getId(),
						order.getSymbol(),
						order.getSide(),
						quote.currentPrice(),
						order.getTargetPrice()
				);
				messagePublisher.publish(order.getId());
			}
		}
	}

	public void handleTriggeredOrder(UUID conditionalOrderId) {
		ConditionalOrder order = conditionalOrderService.requireOrder(conditionalOrderId);

		Optional<Trade> existingTrade = tradeRepository.findByExecutionKey(order.getExecutionKey());
		if (existingTrade.isPresent()) {
			if (order.getStatus() != ConditionalOrderStatus.FILLED) {
				boolean markedFilled = transitionService.markFilled(
						order,
						order.getLastCheckedPrice(),
						existingTrade.get().getExecutedAt(),
						ConditionalOrderFailureCode.ORDER_ALREADY_EXECUTED.name(),
						"Order execution was already persisted",
						Map.of("tradeId", existingTrade.get().getId().toString())
				);
				if (markedFilled) {
					log.info(
							"Conditional order reconciled from existing trade orderId={} tradeId={}",
							order.getId(),
							existingTrade.get().getId()
					);
				}
			}
			return;
		}

		if (order.getStatus() != ConditionalOrderStatus.TRIGGERED) {
			log.info(
					"Conditional order message ignored orderId={} status={} reason=not_triggered",
					order.getId(),
					order.getStatus()
			);
			return;
		}

		boolean executing = transitionService.markExecuting(order, Map.of("receivedAt", clock.instant().toString()));
		if (!executing) {
			log.info("Conditional order execution claim skipped orderId={} reason=state_conflict", order.getId());
			return;
		}

		ConditionalOrder executingOrder = conditionalOrderService.requireOrder(order.getId());
		StockQuote quote;
		try {
			quote = marketDataService.getQuote(executingOrder.getSymbol(), null);
		}
		catch (ApiException ex) {
			boolean reactivated = transitionService.reactivate(
					executingOrder,
					null,
					ConditionalOrderFailureCode.MARKET_DATA_UNAVAILABLE.name(),
					"Market data was unavailable during execution and the order was returned to active",
					Map.of("code", ex.code(), "message", ex.getMessage())
			);
			log.warn(
					"Conditional order execution postponed orderId={} symbol={} reason=market_data_unavailable reactivated={}",
					executingOrder.getId(),
					executingOrder.getSymbol(),
					reactivated
			);
			return;
		}

		if (!priceConditionMet(executingOrder, quote.currentPrice())) {
			boolean reactivated = transitionService.reactivate(
					executingOrder,
					quote.currentPrice(),
					ConditionalOrderFailureCode.PRICE_CONDITION_NOT_MET_ANYMORE.name(),
					"Price condition was no longer satisfied when execution started; order returned to active",
					Map.of("marketPrice", quote.currentPrice(), "targetPrice", executingOrder.getTargetPrice())
			);
			log.info(
					"Conditional order execution returned to active orderId={} symbol={} marketPrice={} targetPrice={} reactivated={}",
					executingOrder.getId(),
					executingOrder.getSymbol(),
					quote.currentPrice(),
					executingOrder.getTargetPrice(),
					reactivated
			);
			return;
		}

		finalizeExecution(executingOrder.getId(), quote);
	}

	@Transactional
	protected void finalizeExecution(UUID conditionalOrderId, StockQuote quote) {
		ConditionalOrder order = conditionalOrderService.requireOrder(conditionalOrderId);
		if (order.getStatus() != ConditionalOrderStatus.EXECUTING) {
			log.info("Conditional order finalize skipped orderId={} status={}", order.getId(), order.getStatus());
			return;
		}

		Optional<Trade> existingTrade = tradeRepository.findByExecutionKey(order.getExecutionKey());
		if (existingTrade.isPresent()) {
			transitionService.markFilled(
					order,
					quote.currentPrice(),
					existingTrade.get().getExecutedAt(),
					ConditionalOrderFailureCode.ORDER_ALREADY_EXECUTED.name(),
					"Order execution was already persisted",
					Map.of("tradeId", existingTrade.get().getId().toString())
			);
			return;
		}

		try {
			TradeExecutionResponse trade = tradeService.executeConditionalOrder(
					order.getUserId(),
					new TradeOrderRequest(order.getSymbol(), order.getSymbol(), order.getQuantity()),
					order.getSide(),
					order.getExecutionKey(),
					quote
			);
			boolean filled = transitionService.markFilled(
					order,
					quote.currentPrice(),
					trade.executedAt(),
					"ORDER_FILLED",
					"Conditional order executed successfully",
					Map.of(
							"tradeId", trade.tradeId().toString(),
							"executedPrice", trade.executedPrice(),
							"grossAmount", trade.grossAmount()
					)
			);
			log.info(
					"Conditional order filled orderId={} tradeId={} symbol={} side={} filled={}",
					order.getId(),
					trade.tradeId(),
					order.getSymbol(),
					order.getSide(),
					filled
			);
		}
		catch (InsufficientFundsException ex) {
			failOrder(order, ConditionalOrderFailureCode.INSUFFICIENT_CASH, ex.getMessage(), quote.currentPrice());
		}
		catch (InvalidTradeException ex) {
			ConditionalOrderFailureCode failureCode = ex.code().contains("SHARES")
					? ConditionalOrderFailureCode.INSUFFICIENT_HOLDINGS
					: ConditionalOrderFailureCode.INTERNAL_ERROR;
			failOrder(order, failureCode, ex.getMessage(), quote.currentPrice());
		}
		catch (ConflictException ex) {
			failOrder(order, ConditionalOrderFailureCode.ORDER_ALREADY_EXECUTED, ex.getMessage(), quote.currentPrice());
		}
		catch (RuntimeException ex) {
			failOrder(order, ConditionalOrderFailureCode.INTERNAL_ERROR, "The conditional order failed unexpectedly", quote.currentPrice());
			log.error(
					"Conditional order execution failed orderId={} symbol={} type={} message={}",
					order.getId(),
					order.getSymbol(),
					ex.getClass().getSimpleName(),
					ex.getMessage(),
					ex
			);
		}
	}

	private void failOrder(
			ConditionalOrder order,
			ConditionalOrderFailureCode failureCode,
			String failureMessage,
			BigDecimal lastCheckedPrice
	) {
		boolean failed = transitionService.markFailed(
				order,
				failureCode,
				failureMessage,
				lastCheckedPrice,
				Map.of("executionKey", order.getExecutionKey())
		);
		log.warn(
				"Conditional order failed orderId={} symbol={} side={} failureCode={} message={} transitioned={}",
				order.getId(),
				order.getSymbol(),
				order.getSide(),
				failureCode,
				failureMessage,
				failed
		);
	}

	private boolean priceConditionMet(ConditionalOrder order, BigDecimal marketPrice) {
		return switch (order.getSide()) {
			case BUY -> marketPrice.compareTo(order.getTargetPrice()) <= 0;
			case SELL -> marketPrice.compareTo(order.getTargetPrice()) >= 0;
		};
	}
}

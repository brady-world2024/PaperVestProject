package com.papervest.orders.execution.service;

import com.papervest.common.exception.ApiException;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.orders.execution.config.OrderExecutionProperties;
import com.papervest.orders.execution.model.OrderExecutionRequest;
import com.papervest.orders.execution.repository.OrderExecutionRequestRepository;
import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderStatus;
import com.papervest.orders.model.OrderStatusEvent;
import com.papervest.orders.model.OrderType;
import com.papervest.orders.repository.OrderRepository;
import com.papervest.orders.repository.OrderStatusEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OrderExecutionTriggerService {

	private static final Logger log = LoggerFactory.getLogger(OrderExecutionTriggerService.class);
	private static final List<OrderType> PENDING_EXECUTION_TYPES = List.of(
			OrderType.LIMIT,
			OrderType.STOP,
			OrderType.STOP_LIMIT
	);

	private final OrderExecutionProperties properties;
	private final OrderRepository orderRepository;
	private final OrderStatusEventRepository orderStatusEventRepository;
	private final OrderExecutionRequestRepository executionRequestRepository;
	private final MarketDataService marketDataService;
	private final TransactionTemplate transactionTemplate;

	public OrderExecutionTriggerService(
			OrderExecutionProperties properties,
			OrderRepository orderRepository,
			OrderStatusEventRepository orderStatusEventRepository,
			OrderExecutionRequestRepository executionRequestRepository,
			MarketDataService marketDataService,
			PlatformTransactionManager transactionManager
	) {
		this.properties = properties;
		this.orderRepository = orderRepository;
		this.orderStatusEventRepository = orderStatusEventRepository;
		this.executionRequestRepository = executionRequestRepository;
		this.marketDataService = marketDataService;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
	}

	public int scanAndQueueTriggeredOrders() {
		List<Order> candidates = orderRepository.findPendingExecutionCandidates(
				OrderStatus.PENDING,
				PENDING_EXECUTION_TYPES,
				PageRequest.of(0, properties.scheduler().batchSize())
		);
		if (candidates.isEmpty()) {
			return 0;
		}

		int queued = 0;
		Map<String, List<Order>> ordersBySymbol = candidates.stream()
				.collect(Collectors.groupingBy(Order::getSymbol, LinkedHashMap::new, Collectors.toList()));
		for (Map.Entry<String, List<Order>> entry : ordersBySymbol.entrySet()) {
			StockQuote quote;
			try {
				quote = marketDataService.getQuote(entry.getKey(), null);
			}
			catch (ApiException ex) {
				log.warn(
						"Order execution trigger skipped symbol={} orderCount={} reason=market_data_unavailable code={}",
						entry.getKey(),
						entry.getValue().size(),
						ex.code()
				);
				continue;
			}
			if (!quote.tradingEnabled()) {
				log.info(
						"Order execution trigger skipped symbol={} session={} reason=market_closed",
						entry.getKey(),
						quote.marketSession()
				);
				continue;
			}
			for (Order order : entry.getValue()) {
				if (OrderExecutionTriggerRules.isExecutable(order, quote.currentPrice())
						&& queueExecutionRequest(order.getId(), quote)) {
					queued++;
				}
			}
		}
		return queued;
	}

	protected boolean queueExecutionRequest(UUID orderId, StockQuote quote) {
		return Boolean.TRUE.equals(transactionTemplate.execute(status -> {
			Order order = orderRepository.findByIdForUpdate(orderId).orElse(null);
			if (order == null || order.getStatus() != OrderStatus.PENDING) {
				return false;
			}
			if (executionRequestRepository.existsByOrderId(order.getId())) {
				return false;
			}
			if (!OrderExecutionTriggerRules.isExecutable(order, quote.currentPrice())) {
				return false;
			}

			executionRequestRepository.save(OrderExecutionRequest.pending(order, quote.currentPrice(), quote.quoteTimestamp()));
			orderStatusEventRepository.save(new OrderStatusEvent(
					order.getId(),
					OrderStatus.PENDING,
					OrderStatus.PENDING,
					"ORDER_EXECUTION_QUEUED",
					"Order execution request queued",
					null
			));
			log.info("Order execution queued orderId={} symbol={} price={}", order.getId(), order.getSymbol(), quote.currentPrice());
			return true;
		}));
	}
}

package com.papervest.orders.service;

import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.ledger.service.LedgerService;
import com.papervest.orders.config.OrderExpirationProperties;
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
import com.papervest.trading.model.Holding;
import com.papervest.trading.repository.HoldingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class OrderExpirationService {

	private static final Logger log = LoggerFactory.getLogger(OrderExpirationService.class);

	private final OrderExpirationProperties properties;
	private final OrderRepository orderRepository;
	private final OrderStatusEventRepository orderStatusEventRepository;
	private final UserAccountRepository userAccountRepository;
	private final HoldingRepository holdingRepository;
	private final LedgerService ledgerService;
	private final OrderExecutionRequestRepository executionRequestRepository;
	private final TransactionTemplate transactionTemplate;

	public OrderExpirationService(
			OrderExpirationProperties properties,
			OrderRepository orderRepository,
			OrderStatusEventRepository orderStatusEventRepository,
			UserAccountRepository userAccountRepository,
			HoldingRepository holdingRepository,
			LedgerService ledgerService,
			OrderExecutionRequestRepository executionRequestRepository,
			PlatformTransactionManager transactionManager
	) {
		this.properties = properties;
		this.orderRepository = orderRepository;
		this.orderStatusEventRepository = orderStatusEventRepository;
		this.userAccountRepository = userAccountRepository;
		this.holdingRepository = holdingRepository;
		this.ledgerService = ledgerService;
		this.executionRequestRepository = executionRequestRepository;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
	}

	public int expireDueOrders() {
		return expireDueOrders(Instant.now());
	}

	public int expireDueOrders(Instant now) {
		List<UUID> orderIds = orderRepository.findDueForExpiration(
						OrderStatus.PENDING,
						now,
						PageRequest.of(0, properties.scheduler().batchSize())
				).stream()
				.map(Order::getId)
				.toList();

		int expired = 0;
		for (UUID orderId : orderIds) {
			if (Boolean.TRUE.equals(transactionTemplate.execute(status -> expireOrder(orderId, now)))) {
				expired++;
			}
		}
		return expired;
	}

	private boolean expireOrder(UUID orderId, Instant now) {
		Order order = orderRepository.findByIdForUpdate(orderId).orElse(null);
		if (order == null
				|| order.getStatus() != OrderStatus.PENDING
				|| order.getExpiresAt() == null
				|| order.getExpiresAt().isAfter(now)) {
			return false;
		}

		releaseReservedCash(order);
		releaseReservedQuantity(order);
		cancelExecutionRequest(order);

		OrderStatus previousStatus = order.expire();
		orderStatusEventRepository.save(new OrderStatusEvent(
				order.getId(),
				previousStatus,
				OrderStatus.EXPIRED,
				"ORDER_EXPIRED",
				"Pending order expired",
				null
		));
		log.info("Order expired orderId={} userId={} symbol={}", order.getId(), order.getUserId(), order.getSymbol());
		return true;
	}

	private void releaseReservedCash(Order order) {
		BigDecimal cashToRelease = order.getReservedCashAmount();
		if (cashToRelease.compareTo(BigDecimal.ZERO) <= 0) {
			return;
		}

		UserAccount account = userAccountRepository.findByUserIdForUpdate(order.getUserId())
				.orElseThrow(() -> new ResourceNotFoundException("ACCOUNT_NOT_FOUND", "User portfolio account could not be found"));
		account.releaseReservedCash(cashToRelease);
		order.releaseReservedCash(cashToRelease);
		ledgerService.recordCashRelease(
				order.getUserId(),
				order.getId(),
				cashToRelease,
				account,
				order.getId() + ":cash-release-expiration"
		);
	}

	private void releaseReservedQuantity(Order order) {
		BigDecimal quantityToRelease = order.getReservedQuantity();
		if (quantityToRelease.compareTo(BigDecimal.ZERO) <= 0) {
			return;
		}

		Holding holding = holdingRepository.findByUserIdAndSymbolForUpdate(order.getUserId(), order.getSymbol())
				.orElseThrow(() -> new ResourceNotFoundException("HOLDING_NOT_FOUND", "Holding could not be found"));
		holding.releaseReservedQuantity(quantityToRelease);
		order.releaseReservedQuantity(quantityToRelease);
		ledgerService.recordPositionRelease(
				order.getUserId(),
				order.getSymbol(),
				order.getId(),
				quantityToRelease,
				holding,
				order.getId() + ":position-release-expiration"
		);
	}

	private void cancelExecutionRequest(Order order) {
		OrderExecutionRequest request = executionRequestRepository.findByOrderId(order.getId()).orElse(null);
		if (request == null
				|| request.getStatus() == OrderExecutionRequestStatus.CONSUMED
				|| request.getStatus() == OrderExecutionRequestStatus.CANCELLED) {
			return;
		}
		request.markCancelled();
	}
}

package com.papervest.integration;

import com.papervest.orders.execution.model.OrderExecutionRequest;
import com.papervest.orders.execution.model.OrderExecutionRequestStatus;
import com.papervest.orders.execution.repository.OrderExecutionRequestRepository;
import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderSource;
import com.papervest.orders.model.OrderTimeInForce;
import com.papervest.orders.model.OrderType;
import com.papervest.orders.repository.OrderRepository;
import com.papervest.trading.model.TradeSide;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class OrderExecutionRequestRepositoryIntegrationTest extends AbstractContainerIntegrationTest {

	@Autowired
	private OrderRepository orderRepository;

	@Autowired
	private OrderExecutionRequestRepository executionRequestRepository;

	@Test
	@Transactional
	void persistsAndLocksPendingExecutionRequests() {
		UUID userId = registerUser();
		Order order = orderRepository.save(new Order(
				userId,
				"AAPL",
				"Apple Inc.",
				TradeSide.BUY,
				OrderType.LIMIT,
				OrderTimeInForce.DAY,
				OrderSource.USER,
				null,
				new BigDecimal("2.0000"),
				new BigDecimal("99.5000"),
				null,
				"repo-test-order"
		));
		order.accept();
		order.markPending(new BigDecimal("199.00"));
		orderRepository.save(order);

		OrderExecutionRequest request = executionRequestRepository.save(OrderExecutionRequest.pending(
				order,
				new BigDecimal("98.7500"),
				Instant.parse("2026-01-02T15:00:00Z")
		));

		List<OrderExecutionRequest> pending = executionRequestRepository.findPendingForDispatch(
				OrderExecutionRequestStatus.PENDING,
				PageRequest.of(0, 10)
		);

		assertThat(pending).extracting(OrderExecutionRequest::getId).containsExactly(request.getId());
		assertThat(executionRequestRepository.existsByOrderId(order.getId())).isTrue();
		assertThat(executionRequestRepository.findByIdForUpdate(request.getId()))
				.hasValueSatisfying(locked -> {
					assertThat(locked.getOrderId()).isEqualTo(order.getId());
					assertThat(locked.getStatus()).isEqualTo(OrderExecutionRequestStatus.PENDING);
					assertThat(locked.getExecutionPrice()).isEqualByComparingTo("98.7500");
				});
	}

	private UUID registerUser() {
		return jdbcTemplate.queryForObject("""
				insert into users (email, password_hash, created_at, updated_at)
				values (?, 'hash', now(), now())
				returning id
				""", UUID.class, "order-exec-repo-" + UUID.randomUUID() + "@example.com");
	}
}

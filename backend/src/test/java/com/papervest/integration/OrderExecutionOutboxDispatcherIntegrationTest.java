package com.papervest.integration;

import com.papervest.orders.execution.messaging.OrderExecutionMessagePublisher;
import com.papervest.orders.execution.model.OrderExecutionRequest;
import com.papervest.orders.execution.model.OrderExecutionRequestStatus;
import com.papervest.orders.execution.repository.OrderExecutionRequestRepository;
import com.papervest.orders.execution.service.OrderExecutionOutboxDispatcher;
import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderSource;
import com.papervest.orders.model.OrderTimeInForce;
import com.papervest.orders.model.OrderType;
import com.papervest.orders.repository.OrderRepository;
import com.papervest.trading.model.TradeSide;
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@SpringBootTest
@ActiveProfiles("test")
class OrderExecutionOutboxDispatcherIntegrationTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private OrderRepository orderRepository;

	@Autowired
	private OrderExecutionRequestRepository requestRepository;

	@Autowired
	private OrderExecutionOutboxDispatcher dispatcher;

	@MockitoBean
	private OrderExecutionMessagePublisher publisher;

	@Test
	void dispatchPublishesPendingRequestAndMarksPublished() {
		OrderExecutionRequest request = requestRepository.save(OrderExecutionRequest.pending(
				order(),
				new BigDecimal("99.0000"),
				Instant.now()
		));

		int published = dispatcher.dispatchPendingRequests();

		OrderExecutionRequest updated = requestRepository.findById(request.getId()).orElseThrow();
		assertThat(published).isEqualTo(1);
		assertThat(updated.getStatus()).isEqualTo(OrderExecutionRequestStatus.PUBLISHED);
		assertThat(updated.getPublishAttemptCount()).isEqualTo(1);
		assertThat(updated.getPublishedAt()).isNotNull();
		verify(publisher).publish(any());
	}

	@Test
	void publishFailureLeavesRequestPendingWithError() {
		OrderExecutionRequest request = requestRepository.save(OrderExecutionRequest.pending(
				order(),
				new BigDecimal("99.0000"),
				Instant.now()
		));
		doThrow(new IllegalStateException("rabbit unavailable")).when(publisher).publish(any());

		int published = dispatcher.dispatchPendingRequests();

		OrderExecutionRequest updated = requestRepository.findById(request.getId()).orElseThrow();
		assertThat(published).isZero();
		assertThat(updated.getStatus()).isEqualTo(OrderExecutionRequestStatus.PENDING);
		assertThat(updated.getPublishAttemptCount()).isEqualTo(1);
		assertThat(updated.getLastPublishError()).contains("rabbit unavailable");
	}

	private Order order() {
		User user = userRepository.save(new User("order-exec-dispatch-" + UUID.randomUUID() + "@example.com", "hash"));
		Order order = orderRepository.save(new Order(
				user.getId(),
				"AAPL",
				"Apple Inc.",
				TradeSide.BUY,
				OrderType.LIMIT,
				OrderTimeInForce.DAY,
				OrderSource.USER,
				null,
				new BigDecimal("1.0000"),
				new BigDecimal("99.0000"),
				null,
				"dispatch-" + UUID.randomUUID()
		));
		order.accept();
		order.markPending(new BigDecimal("99.00"));
		return orderRepository.save(order);
	}
}

package com.papervest.integration;

import com.papervest.auth.dto.RegisterRequest;
import com.papervest.auth.service.AuthService;
import com.papervest.orders.dto.CreateOrderRequest;
import com.papervest.orders.execution.messaging.OrderExecutionMessagePublisher;
import com.papervest.orders.execution.model.OrderExecutionRequest;
import com.papervest.orders.execution.model.OrderExecutionRequestStatus;
import com.papervest.orders.execution.repository.OrderExecutionRequestRepository;
import com.papervest.orders.execution.service.OrderExecutionOutboxDispatcher;
import com.papervest.orders.execution.service.OrderExecutionTriggerService;
import com.papervest.orders.model.OrderStatus;
import com.papervest.orders.model.OrderTimeInForce;
import com.papervest.orders.model.OrderType;
import com.papervest.orders.repository.OrderRepository;
import com.papervest.orders.service.OrderService;
import com.papervest.trading.model.TradeSide;
import com.papervest.trading.repository.TradeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

@TestPropertySource(properties = {
		"app.orders.execution.messaging.listener-enabled=true"
})
class OrderExecutionMessagingIntegrationTest extends AbstractContainerIntegrationTest {

	@Autowired
	private AuthService authService;

	@Autowired
	private OrderService orderService;

	@Autowired
	private OrderRepository orderRepository;

	@Autowired
	private OrderExecutionRequestRepository requestRepository;

	@Autowired
	private OrderExecutionTriggerService triggerService;

	@Autowired
	private OrderExecutionOutboxDispatcher dispatcher;

	@Autowired
	private OrderExecutionMessagePublisher publisher;

	@Autowired
	private TradeRepository tradeRepository;

	@Test
	void triggeredPendingOrderPublishesAndFillsThroughRabbitMq() {
		UUID userId = registerUser();
		UUID orderId = createPendingLimitBuy(userId);

		assertThat(triggerService.scanAndQueueTriggeredOrders()).isEqualTo(1);
		assertThat(dispatcher.dispatchPendingRequests()).isEqualTo(1);

		OrderExecutionRequest consumed = await(
				"order execution request consumed",
				() -> requestRepository.findByOrderId(orderId).orElseThrow(),
				request -> request.getStatus() == OrderExecutionRequestStatus.CONSUMED
		);

		assertThat(consumed.getConsumedAt()).isNotNull();
		assertThat(orderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(OrderStatus.FILLED);
		assertThat(tradeRepository.findAll()).hasSize(1);
		assertThat(tradeRepository.findAll().getFirst().getExecutionKey()).isEqualTo("order-execution-" + orderId);
	}

	@Test
	void duplicateRabbitDeliveriesDoNotDuplicateTrades() {
		UUID userId = registerUser();
		UUID orderId = createPendingLimitBuy(userId);
		triggerService.scanAndQueueTriggeredOrders();
		dispatcher.dispatchPendingRequests();
		OrderExecutionRequest request = await(
				"initial async fill",
				() -> requestRepository.findByOrderId(orderId).orElseThrow(),
				value -> value.getStatus() == OrderExecutionRequestStatus.CONSUMED
		);

		publisher.publish(request);
		publisher.publish(request);

		await("duplicate delivery no-op", () -> tradeRepository.findAll().size(), count -> count == 1);
		assertThat(tradeRepository.findAll()).hasSize(1);
		assertThat(requestRepository.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(OrderExecutionRequestStatus.CONSUMED);
	}

	private UUID registerUser() {
		return authService.register(new RegisterRequest(
				"order-exec-mq-" + UUID.randomUUID() + "@example.com",
				"SecurePass1",
				"SecurePass1",
				"Order Execution MQ Test"
		)).user().id();
	}

	private UUID createPendingLimitBuy(UUID userId) {
		return orderService.submitPendingOrder(
				userId,
				new CreateOrderRequest(
						"AAPL",
						"Apple Inc.",
						TradeSide.BUY,
						OrderType.LIMIT,
						OrderTimeInForce.DAY,
						new BigDecimal("1.0000"),
						new BigDecimal("199.0000"),
						null
				),
				"mq-order-" + UUID.randomUUID()
		).id();
	}

	private <T> T await(String description, Supplier<T> supplier, Predicate<T> ready) {
		Instant deadline = Instant.now().plus(Duration.ofSeconds(15));
		T current = supplier.get();
		while (!ready.test(current) && Instant.now().isBefore(deadline)) {
			try {
				Thread.sleep(250);
			}
			catch (InterruptedException ex) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException("Interrupted while waiting for " + description, ex);
			}
			current = supplier.get();
		}
		assertThat(ready.test(current)).as("Timed out waiting for %s", description).isTrue();
		return current;
	}
}

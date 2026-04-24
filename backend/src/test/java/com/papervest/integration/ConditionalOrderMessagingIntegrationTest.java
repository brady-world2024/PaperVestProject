package com.papervest.integration;

import com.papervest.auth.dto.RegisterRequest;
import com.papervest.auth.service.AuthService;
import com.papervest.conditionalorder.dto.CreateConditionalOrderRequest;
import com.papervest.conditionalorder.model.ConditionalOrder;
import com.papervest.conditionalorder.model.ConditionalOrderStatus;
import com.papervest.conditionalorder.model.ConditionalOrderStatusEvent;
import com.papervest.conditionalorder.messaging.ConditionalOrderMessagePublisher;
import com.papervest.conditionalorder.repository.ConditionalOrderRepository;
import com.papervest.conditionalorder.repository.ConditionalOrderStatusEventRepository;
import com.papervest.conditionalorder.service.ConditionalOrderExecutionService;
import com.papervest.conditionalorder.service.ConditionalOrderService;
import com.papervest.trading.model.Trade;
import com.papervest.trading.model.TradeSide;
import com.papervest.trading.repository.TradeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

@TestPropertySource(properties = {
		"app.conditional-orders.messaging.listener-enabled=true"
})
class ConditionalOrderMessagingIntegrationTest extends AbstractContainerIntegrationTest {

	@Autowired
	private AuthService authService;

	@Autowired
	private ConditionalOrderService conditionalOrderService;

	@Autowired
	private ConditionalOrderExecutionService conditionalOrderExecutionService;

	@Autowired
	private ConditionalOrderMessagePublisher messagePublisher;

	@Autowired
	private ConditionalOrderRepository conditionalOrderRepository;

	@Autowired
	private ConditionalOrderStatusEventRepository statusEventRepository;

	@Autowired
	private TradeRepository tradeRepository;

	@Test
	void conditionalOrderPublishesToRabbitAndConsumesExactlyOnce() {
		UUID userId = registerUserId();
		UUID orderId = UUID.fromString(conditionalOrderService.create(
				userId,
				new CreateConditionalOrderRequest(
						"AAPL",
						TradeSide.BUY,
						new BigDecimal("200.0000"),
						new BigDecimal("1.0000"),
						null
				)
		).id());

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();

		ConditionalOrder filledOrder = await(
				"conditional order fill after rabbitmq consume",
				() -> conditionalOrderRepository.findById(orderId).orElseThrow(),
				order -> order.getStatus() == ConditionalOrderStatus.FILLED
		);
		List<Trade> trades = tradeRepository.findAll();
		List<ConditionalOrderStatusEvent> events = statusEventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(orderId);

		assertThat(filledOrder.getExecutedAt()).isNotNull();
		assertThat(trades).hasSize(1);
		assertThat(trades.get(0).getExecutionKey()).isEqualTo("conditional-order-" + orderId);
		assertThat(events).extracting(ConditionalOrderStatusEvent::getReasonCode)
				.containsExactly("ORDER_CREATED", "TARGET_PRICE_REACHED", "EXECUTION_STARTED", "ORDER_FILLED");
	}

	@Test
	void duplicateRabbitDeliveriesDoNotCreateDuplicateTrades() {
		UUID userId = registerUserId();
		UUID orderId = UUID.fromString(conditionalOrderService.create(
				userId,
				new CreateConditionalOrderRequest(
						"AAPL",
						TradeSide.BUY,
						new BigDecimal("200.0000"),
						new BigDecimal("1.0000"),
						null
				)
		).id());

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();
		await(
				"initial conditional order fill",
				() -> conditionalOrderRepository.findById(orderId).orElseThrow(),
				order -> order.getStatus() == ConditionalOrderStatus.FILLED
		);

		messagePublisher.publish(orderId);
		messagePublisher.publish(orderId);

		await(
				"duplicate delivery reconciliation",
				() -> tradeRepository.findAll(),
				trades -> trades.size() == 1
		);

		List<Trade> trades = tradeRepository.findAll();
		assertThat(trades).hasSize(1);
		assertThat(trades.get(0).getExecutionKey()).isEqualTo("conditional-order-" + orderId);
		assertThat(conditionalOrderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(ConditionalOrderStatus.FILLED);
	}

	private UUID registerUserId() {
		return authService.register(new RegisterRequest(
				"rabbit-" + UUID.randomUUID() + "@example.com",
				"SecurePass1",
				"SecurePass1",
				"RabbitMQ Integration Test"
		)).user().id();
	}

	private <T> T await(String description, Supplier<T> supplier, java.util.function.Predicate<T> ready) {
		Instant deadline = Instant.now().plus(Duration.ofSeconds(15));
		T current = supplier.get();
		while (!ready.test(current) && Instant.now().isBefore(deadline)) {
			try {
				Thread.sleep(250);
			}
			catch (InterruptedException interruptedException) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException("Interrupted while waiting for " + description, interruptedException);
			}
			current = supplier.get();
		}

		assertThat(ready.test(current))
				.as("Timed out waiting for %s", description)
				.isTrue();
		return current;
	}
}

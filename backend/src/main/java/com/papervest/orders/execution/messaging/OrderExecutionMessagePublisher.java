package com.papervest.orders.execution.messaging;

import com.papervest.orders.execution.config.OrderExecutionProperties;
import com.papervest.orders.execution.model.OrderExecutionRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class OrderExecutionMessagePublisher {

	private static final Logger log = LoggerFactory.getLogger(OrderExecutionMessagePublisher.class);

	private final RabbitTemplate rabbitTemplate;
	private final OrderExecutionProperties properties;

	public OrderExecutionMessagePublisher(RabbitTemplate rabbitTemplate, OrderExecutionProperties properties) {
		this.rabbitTemplate = rabbitTemplate;
		this.properties = properties;
	}

	public void publish(OrderExecutionRequest request) {
		rabbitTemplate.convertAndSend(
				properties.messaging().exchange(),
				properties.messaging().routingKey(),
				new OrderExecutionMessage(request.getId(), request.getOrderId())
		);
		log.info("Order execution message published requestId={} orderId={}", request.getId(), request.getOrderId());
	}
}

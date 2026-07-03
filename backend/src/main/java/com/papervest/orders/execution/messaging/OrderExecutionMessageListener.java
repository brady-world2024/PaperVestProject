package com.papervest.orders.execution.messaging;

import com.papervest.orders.execution.service.OrderExecutionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class OrderExecutionMessageListener {

	private static final Logger log = LoggerFactory.getLogger(OrderExecutionMessageListener.class);

	private final OrderExecutionService executionService;

	public OrderExecutionMessageListener(OrderExecutionService executionService) {
		this.executionService = executionService;
	}

	@RabbitListener(
			queues = "${app.orders.execution.messaging.queue}",
			autoStartup = "${app.orders.execution.messaging.listener-enabled:true}"
	)
	public void handle(OrderExecutionMessage message) {
		log.info(
				"Order execution message received requestId={} orderId={}",
				message.executionRequestId(),
				message.orderId()
		);
		executionService.executeRequest(message.executionRequestId());
	}
}

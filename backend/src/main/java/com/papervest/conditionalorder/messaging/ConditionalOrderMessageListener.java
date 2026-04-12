package com.papervest.conditionalorder.messaging;

import com.papervest.conditionalorder.service.ConditionalOrderExecutionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class ConditionalOrderMessageListener {

	private static final Logger log = LoggerFactory.getLogger(ConditionalOrderMessageListener.class);

	private final ConditionalOrderExecutionService conditionalOrderExecutionService;

	public ConditionalOrderMessageListener(ConditionalOrderExecutionService conditionalOrderExecutionService) {
		this.conditionalOrderExecutionService = conditionalOrderExecutionService;
	}

	@RabbitListener(
			queues = "${app.conditional-orders.messaging.queue}",
			autoStartup = "${app.conditional-orders.messaging.listener-enabled:true}"
	)
	public void handle(ConditionalOrderExecutionMessage message) {
		log.info("Conditional order message received orderId={}", message.conditionalOrderId());
		conditionalOrderExecutionService.handleTriggeredOrder(message.conditionalOrderId());
	}
}

package com.papervest.conditionalorder.messaging;

import com.papervest.conditionalorder.config.ConditionalOrderProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ConditionalOrderMessagePublisher {

	private static final Logger log = LoggerFactory.getLogger(ConditionalOrderMessagePublisher.class);

	private final RabbitTemplate rabbitTemplate;
	private final ConditionalOrderProperties properties;

	public ConditionalOrderMessagePublisher(RabbitTemplate rabbitTemplate, ConditionalOrderProperties properties) {
		this.rabbitTemplate = rabbitTemplate;
		this.properties = properties;
	}

	public void publish(UUID conditionalOrderId) {
		rabbitTemplate.convertAndSend(
				properties.messaging().exchange(),
				properties.messaging().routingKey(),
				new ConditionalOrderExecutionMessage(conditionalOrderId)
		);
		log.info(
				"Conditional order message published orderId={} exchange={} routingKey={}",
				conditionalOrderId,
				properties.messaging().exchange(),
				properties.messaging().routingKey()
		);
	}
}

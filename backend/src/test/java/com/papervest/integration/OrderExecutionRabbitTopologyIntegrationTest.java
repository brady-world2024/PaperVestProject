package com.papervest.integration;

import com.papervest.orders.execution.config.OrderExecutionProperties;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class OrderExecutionRabbitTopologyIntegrationTest extends AbstractContainerIntegrationTest {

	@Autowired
	private OrderExecutionProperties properties;

	@Autowired
	private AmqpAdmin amqpAdmin;

	@Test
	void declaresExecutionQueueAndDeadLetterQueue() {
		assertThat(properties.messaging().exchange()).isEqualTo("orders.execution.exchange");
		assertThat(amqpAdmin.getQueueInfo(properties.messaging().queue())).isNotNull();
		assertThat(amqpAdmin.getQueueInfo(properties.messaging().deadLetterQueue())).isNotNull();
	}
}

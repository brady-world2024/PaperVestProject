package com.papervest.orders.execution.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OrderExecutionRabbitConfig {

	@Bean
	DirectExchange orderExecutionExchange(OrderExecutionProperties properties) {
		return new DirectExchange(properties.messaging().exchange(), true, false);
	}

	@Bean
	DirectExchange orderExecutionDeadLetterExchange(OrderExecutionProperties properties) {
		return new DirectExchange(properties.messaging().deadLetterExchange(), true, false);
	}

	@Bean
	Queue orderExecutionQueue(OrderExecutionProperties properties) {
		return QueueBuilder.durable(properties.messaging().queue())
				.deadLetterExchange(properties.messaging().deadLetterExchange())
				.deadLetterRoutingKey(properties.messaging().deadLetterRoutingKey())
				.build();
	}

	@Bean
	Queue orderExecutionDeadLetterQueue(OrderExecutionProperties properties) {
		return QueueBuilder.durable(properties.messaging().deadLetterQueue()).build();
	}

	@Bean
	Binding orderExecutionBinding(
			Queue orderExecutionQueue,
			DirectExchange orderExecutionExchange,
			OrderExecutionProperties properties
	) {
		return BindingBuilder.bind(orderExecutionQueue)
				.to(orderExecutionExchange)
				.with(properties.messaging().routingKey());
	}

	@Bean
	Binding orderExecutionDeadLetterBinding(
			Queue orderExecutionDeadLetterQueue,
			DirectExchange orderExecutionDeadLetterExchange,
			OrderExecutionProperties properties
	) {
		return BindingBuilder.bind(orderExecutionDeadLetterQueue)
				.to(orderExecutionDeadLetterExchange)
				.with(properties.messaging().deadLetterRoutingKey());
	}
}

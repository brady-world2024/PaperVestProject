package com.papervest.conditionalorder.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.boot.amqp.autoconfigure.SimpleRabbitListenerContainerFactoryConfigurer;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ConditionalOrderRabbitConfig {

	@Bean
	DirectExchange conditionalOrderExchange(ConditionalOrderProperties properties) {
		return new DirectExchange(properties.messaging().exchange(), true, false);
	}

	@Bean
	Queue conditionalOrderQueue(ConditionalOrderProperties properties) {
		return QueueBuilder.durable(properties.messaging().queue()).build();
	}

	@Bean
	Binding conditionalOrderBinding(
			Queue conditionalOrderQueue,
			DirectExchange conditionalOrderExchange,
			ConditionalOrderProperties properties
	) {
		return BindingBuilder.bind(conditionalOrderQueue)
				.to(conditionalOrderExchange)
				.with(properties.messaging().routingKey());
	}

	@Bean
	RabbitAdmin rabbitAdmin(ConnectionFactory connectionFactory) {
		return new RabbitAdmin(connectionFactory);
	}

	@Bean
	MessageConverter rabbitMessageConverter() {
		return new Jackson2JsonMessageConverter();
	}

	@Bean
	RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter rabbitMessageConverter) {
		RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
		rabbitTemplate.setMessageConverter(rabbitMessageConverter);
		return rabbitTemplate;
	}

	@Bean
	SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
			SimpleRabbitListenerContainerFactoryConfigurer configurer,
			ConnectionFactory connectionFactory,
			MessageConverter rabbitMessageConverter
	) {
		SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
		configurer.configure(factory, connectionFactory);
		factory.setMessageConverter(rabbitMessageConverter);
		return factory;
	}
}

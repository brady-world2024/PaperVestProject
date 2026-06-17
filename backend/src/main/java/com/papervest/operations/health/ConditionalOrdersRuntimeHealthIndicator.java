package com.papervest.operations.health;

import com.papervest.conditionalorder.config.ConditionalOrderProperties;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("conditionalOrdersRuntime")
public class ConditionalOrdersRuntimeHealthIndicator implements HealthIndicator {

	private final ConditionalOrderProperties properties;

	public ConditionalOrdersRuntimeHealthIndicator(ConditionalOrderProperties properties) {
		this.properties = properties;
	}

	@Override
	public Health health() {
		return Health.up()
				.withDetail("schedulerEnabled", properties.scheduler().enabled())
				.withDetail("schedulerBatchSize", properties.scheduler().batchSize())
				.withDetail("schedulerFixedDelayMs", properties.scheduler().fixedDelayMs())
				.withDetail("listenerEnabled", properties.messaging().listenerEnabled())
				.withDetail("exchange", properties.messaging().exchange())
				.withDetail("queue", properties.messaging().queue())
				.withDetail("routingKey", properties.messaging().routingKey())
				.build();
	}
}

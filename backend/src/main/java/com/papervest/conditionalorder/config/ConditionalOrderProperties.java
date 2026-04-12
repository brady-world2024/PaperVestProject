package com.papervest.conditionalorder.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("app.conditional-orders")
public record ConditionalOrderProperties(
		@NotNull @Valid SchedulerProperties scheduler,
		@NotNull @Valid MessagingProperties messaging
) {

	public record SchedulerProperties(
			boolean enabled,
			@Min(1) int batchSize,
			@Min(1000) long fixedDelayMs
	) {
	}

	public record MessagingProperties(
			@NotBlank String exchange,
			@NotBlank String queue,
			@NotBlank String routingKey,
			boolean listenerEnabled
	) {
	}
}

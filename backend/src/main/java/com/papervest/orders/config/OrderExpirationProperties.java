package com.papervest.orders.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("app.orders.expiration")
public record OrderExpirationProperties(
		@NotNull @Valid SchedulerProperties scheduler
) {

	public record SchedulerProperties(
			boolean enabled,
			@Min(1) int batchSize,
			@Min(1000) long fixedDelayMs
	) {
	}
}

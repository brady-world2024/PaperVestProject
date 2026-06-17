package com.papervest.common.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties("app.account-lifecycle")
public record AccountLifecycleProperties(
		@NotBlank String webBaseUrl,
		@NotNull Duration emailVerificationTokenTtl,
		@NotNull Duration passwordResetTokenTtl
) {
}

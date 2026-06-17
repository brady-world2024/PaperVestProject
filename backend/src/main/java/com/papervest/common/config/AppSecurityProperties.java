package com.papervest.common.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.List;

@Validated
@ConfigurationProperties("app.security")
public record AppSecurityProperties(
		@NotBlank String jwtSecret,
		Duration accessTokenTtl,
		Duration refreshTokenTtl,
		@NotEmpty List<String> allowedOrigins,
		@Valid AuthCookieProperties authCookie,
		@Valid AuthRateLimitProperties authRateLimit
) {

	public record AuthCookieProperties(
			@NotBlank String accessTokenName,
			@NotBlank String refreshTokenName,
			boolean secure,
			@NotBlank
			@Pattern(regexp = "Strict|Lax|None", message = "sameSite must be Strict, Lax, or None")
			String sameSite,
			@NotBlank String accessTokenPath,
			@NotBlank String refreshTokenPath
	) {
	}

	public record AuthRateLimitProperties(
			boolean enabled,
			Duration window,
			int loginMaxAttempts,
			int registerMaxAttempts,
			int passwordResetRequestMaxAttempts,
			int passwordResetConfirmMaxAttempts,
			int emailVerificationConfirmMaxAttempts
	) {
	}
}

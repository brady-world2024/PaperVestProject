package com.papervest.common.config;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.math.BigDecimal;

@Validated
@ConfigurationProperties("app.portfolio")
public record PortfolioProperties(
		@NotNull
		@DecimalMin("0.01")
		BigDecimal initialCash
) {
}

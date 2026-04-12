package com.papervest.conditionalorder.dto;

import com.papervest.trading.model.TradeSide;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

public record CreateConditionalOrderRequest(
		@NotBlank
		@Size(max = 16)
		String symbol,
		@NotNull
		TradeSide side,
		@NotNull
		@DecimalMin(value = "0.0001", inclusive = true, message = "Target price must be greater than zero")
		BigDecimal targetPrice,
		@NotNull
		@DecimalMin(value = "0.0001", inclusive = true, message = "Quantity must be greater than zero")
		BigDecimal quantity,
		Instant expiresAt
) {
}

package com.papervest.orders.dto;

import com.papervest.orders.model.OrderTimeInForce;
import com.papervest.orders.model.OrderType;
import com.papervest.trading.model.TradeSide;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateOrderRequest(
		@NotBlank
		@Size(max = 16)
		String symbol,
		@Size(max = 255)
		String companyName,
		@NotNull
		TradeSide side,
		@NotNull
		OrderType orderType,
		@NotNull
		OrderTimeInForce timeInForce,
		@NotNull
		@DecimalMin(value = "0.0001", inclusive = true, message = "Quantity must be greater than zero")
		BigDecimal quantity,
		@DecimalMin(value = "0.0001", inclusive = true, message = "Limit price must be greater than zero")
		BigDecimal limitPrice,
		@DecimalMin(value = "0.0001", inclusive = true, message = "Stop price must be greater than zero")
		BigDecimal stopPrice
) {
}

package com.papervest.trading.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record TradeOrderRequest(
		@NotBlank
		@Pattern(regexp = "^[A-Za-z][A-Za-z.\\-]{0,15}$", message = "Symbol format is invalid")
		String symbol,
		@Size(max = 255) String companyName,
		@DecimalMin(value = "0.0001", message = "Quantity must be greater than zero")
		@Digits(integer = 12, fraction = 4)
		BigDecimal quantity
) {
}

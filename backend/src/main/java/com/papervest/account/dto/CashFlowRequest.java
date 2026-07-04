package com.papervest.account.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CashFlowRequest(
		@NotNull
		@DecimalMin(value = "0.01", inclusive = true, message = "Amount must be greater than zero")
		@Digits(integer = 12, fraction = 2)
		BigDecimal amount,
		String memo
) {
}

package com.papervest.orders.dto;

import com.papervest.orders.model.OrderSource;
import com.papervest.orders.model.OrderStatus;
import com.papervest.orders.model.OrderTimeInForce;
import com.papervest.orders.model.OrderType;
import com.papervest.trading.model.TradeSide;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrderResponse(
		UUID id,
		String symbol,
		String companyName,
		TradeSide side,
		OrderType orderType,
		OrderTimeInForce timeInForce,
		OrderStatus status,
		OrderSource source,
		UUID sourceRefId,
		BigDecimal requestedQuantity,
		BigDecimal filledQuantity,
		BigDecimal limitPrice,
		BigDecimal stopPrice,
		BigDecimal estimatedGrossAmount,
		BigDecimal reservedCashAmount,
		BigDecimal reservedQuantity,
		String rejectionCode,
		String rejectionMessage,
		Instant submittedAt,
		Instant acceptedAt,
		Instant completedAt,
		Instant cancelledAt,
		Instant expiresAt,
		Instant createdAt,
		Instant updatedAt
) {
}

package com.papervest.conditionalorder.dto;

import com.papervest.conditionalorder.model.ConditionalOrderFailureCode;
import com.papervest.conditionalorder.model.ConditionalOrderStatus;
import com.papervest.conditionalorder.model.ConditionalOrderTriggerType;
import com.papervest.trading.model.TradeSide;

import java.math.BigDecimal;
import java.time.Instant;

public record ConditionalOrderResponse(
		String id,
		String symbol,
		TradeSide side,
		ConditionalOrderTriggerType triggerType,
		BigDecimal targetPrice,
		BigDecimal quantity,
		ConditionalOrderStatus status,
		ConditionalOrderFailureCode failureCode,
		String failureMessage,
		String executionKey,
		BigDecimal lastCheckedPrice,
		Instant triggeredAt,
		Instant executedAt,
		Instant expiresAt,
		Instant createdAt,
		Instant updatedAt,
		long version
) {
}

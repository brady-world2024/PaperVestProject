package com.papervest.orders.dto;

import com.papervest.orders.execution.model.OrderExecutionRequestStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrderExecutionSummaryResponse(
		UUID id,
		OrderExecutionRequestStatus status,
		BigDecimal triggerPrice,
		BigDecimal executionPrice,
		Instant quoteTimestamp,
		Instant publishedAt,
		Instant consumedAt,
		String lastPublishError,
		int publishAttemptCount,
		Instant createdAt,
		Instant updatedAt
) {
}

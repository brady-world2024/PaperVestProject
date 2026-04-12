package com.papervest.conditionalorder.dto;

import com.papervest.conditionalorder.model.ConditionalOrderStatus;

import java.time.Instant;
import java.util.Map;

public record ConditionalOrderStatusEventResponse(
		String id,
		ConditionalOrderStatus fromStatus,
		ConditionalOrderStatus toStatus,
		String reasonCode,
		String reasonMessage,
		Map<String, Object> metadata,
		Instant createdAt
) {
}

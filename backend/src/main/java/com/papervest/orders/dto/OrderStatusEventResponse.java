package com.papervest.orders.dto;

import com.papervest.orders.model.OrderStatus;

import java.time.Instant;
import java.util.UUID;

public record OrderStatusEventResponse(
		UUID id,
		OrderStatus fromStatus,
		OrderStatus toStatus,
		String reasonCode,
		String reasonMessage,
		String metadataJson,
		Instant createdAt
) {
}

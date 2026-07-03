package com.papervest.orders.execution.messaging;

import java.util.UUID;

public record OrderExecutionMessage(UUID executionRequestId, UUID orderId) {
}

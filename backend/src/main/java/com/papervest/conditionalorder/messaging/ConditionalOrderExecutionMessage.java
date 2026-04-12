package com.papervest.conditionalorder.messaging;

import java.util.UUID;

public record ConditionalOrderExecutionMessage(UUID conditionalOrderId) {
}

package com.papervest.reconciliation.model;

import java.util.UUID;

public record ReconciliationIssue(
		ReconciliationIssueCode code,
		ReconciliationSeverity severity,
		UUID userId,
		String symbol,
		UUID orderId,
		String expectedValue,
		String actualValue,
		String message
) {
}

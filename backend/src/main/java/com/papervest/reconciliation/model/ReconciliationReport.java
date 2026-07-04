package com.papervest.reconciliation.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public record ReconciliationReport(
		Instant checkedAt,
		List<ReconciliationIssue> issues
) {

	public ReconciliationReport {
		issues = List.copyOf(issues);
	}

	public boolean healthy() {
		return issues.isEmpty();
	}

	public int issueCount() {
		return issues.size();
	}

	public Map<ReconciliationIssueCode, Long> issueCountsByCode() {
		return issues.stream()
				.collect(Collectors.groupingBy(ReconciliationIssue::code, Collectors.counting()));
	}
}

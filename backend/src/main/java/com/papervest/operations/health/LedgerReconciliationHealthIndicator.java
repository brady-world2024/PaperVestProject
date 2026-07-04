package com.papervest.operations.health;

import com.papervest.reconciliation.model.ReconciliationReport;
import com.papervest.reconciliation.service.ReconciliationService;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("ledgerReconciliation")
public class LedgerReconciliationHealthIndicator implements HealthIndicator {

	private final ReconciliationService reconciliationService;

	public LedgerReconciliationHealthIndicator(ReconciliationService reconciliationService) {
		this.reconciliationService = reconciliationService;
	}

	@Override
	public Health health() {
		ReconciliationReport report = reconciliationService.scan();
		Health.Builder builder = report.healthy() ? Health.up() : Health.down();
		return builder
				.withDetail("checkedAt", report.checkedAt())
				.withDetail("issueCount", report.issueCount())
				.withDetail("issueCountsByCode", report.issueCountsByCode())
				.build();
	}
}

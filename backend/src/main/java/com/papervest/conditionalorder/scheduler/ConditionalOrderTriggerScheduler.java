package com.papervest.conditionalorder.scheduler;

import com.papervest.conditionalorder.config.ConditionalOrderProperties;
import com.papervest.conditionalorder.service.ConditionalOrderExecutionService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(value = "app.conditional-orders.scheduler.enabled", havingValue = "true", matchIfMissing = true)
public class ConditionalOrderTriggerScheduler {

	private final ConditionalOrderProperties properties;
	private final ConditionalOrderExecutionService conditionalOrderExecutionService;

	public ConditionalOrderTriggerScheduler(
			ConditionalOrderProperties properties,
			ConditionalOrderExecutionService conditionalOrderExecutionService
	) {
		this.properties = properties;
		this.conditionalOrderExecutionService = conditionalOrderExecutionService;
	}

	@Scheduled(fixedDelayString = "${app.conditional-orders.scheduler.fixed-delay-ms:10000}")
	public void scan() {
		if (!properties.scheduler().enabled()) {
			return;
		}
		conditionalOrderExecutionService.scanAndTriggerReadyOrders();
	}
}

package com.papervest.orders.execution.scheduler;

import com.papervest.orders.execution.config.OrderExecutionProperties;
import com.papervest.orders.execution.service.OrderExecutionTriggerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OrderExecutionTriggerScheduler {

	private static final Logger log = LoggerFactory.getLogger(OrderExecutionTriggerScheduler.class);

	private final OrderExecutionProperties properties;
	private final OrderExecutionTriggerService triggerService;

	public OrderExecutionTriggerScheduler(
			OrderExecutionProperties properties,
			OrderExecutionTriggerService triggerService
	) {
		this.properties = properties;
		this.triggerService = triggerService;
	}

	@Scheduled(fixedDelayString = "${app.orders.execution.scheduler.fixed-delay-ms}")
	public void scan() {
		if (!properties.scheduler().enabled()) {
			return;
		}
		int queued = triggerService.scanAndQueueTriggeredOrders();
		if (queued > 0) {
			log.info("Order execution trigger scheduler queued count={}", queued);
		}
	}
}

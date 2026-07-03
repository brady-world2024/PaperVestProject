package com.papervest.orders.execution.scheduler;

import com.papervest.orders.execution.config.OrderExecutionProperties;
import com.papervest.orders.execution.service.OrderExecutionOutboxDispatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OrderExecutionOutboxDispatcherScheduler {

	private static final Logger log = LoggerFactory.getLogger(OrderExecutionOutboxDispatcherScheduler.class);

	private final OrderExecutionProperties properties;
	private final OrderExecutionOutboxDispatcher dispatcher;

	public OrderExecutionOutboxDispatcherScheduler(
			OrderExecutionProperties properties,
			OrderExecutionOutboxDispatcher dispatcher
	) {
		this.properties = properties;
		this.dispatcher = dispatcher;
	}

	@Scheduled(fixedDelayString = "${app.orders.execution.dispatcher.fixed-delay-ms}")
	public void dispatch() {
		if (!properties.dispatcher().enabled()) {
			return;
		}
		int published = dispatcher.dispatchPendingRequests();
		if (published > 0) {
			log.info("Order execution dispatcher published count={}", published);
		}
	}
}

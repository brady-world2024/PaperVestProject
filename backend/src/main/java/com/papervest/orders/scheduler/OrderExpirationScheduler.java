package com.papervest.orders.scheduler;

import com.papervest.orders.config.OrderExpirationProperties;
import com.papervest.orders.service.OrderExpirationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OrderExpirationScheduler {

	private static final Logger log = LoggerFactory.getLogger(OrderExpirationScheduler.class);

	private final OrderExpirationProperties properties;
	private final OrderExpirationService expirationService;

	public OrderExpirationScheduler(
			OrderExpirationProperties properties,
			OrderExpirationService expirationService
	) {
		this.properties = properties;
		this.expirationService = expirationService;
	}

	@Scheduled(fixedDelayString = "${app.orders.expiration.scheduler.fixed-delay-ms}")
	public void scan() {
		if (!properties.scheduler().enabled()) {
			return;
		}
		int expired = expirationService.expireDueOrders();
		if (expired > 0) {
			log.info("Order expiration scheduler expired count={}", expired);
		}
	}
}

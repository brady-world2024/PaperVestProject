package com.papervest.integration;

import com.papervest.conditionalorder.config.ConditionalOrderProperties;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("ci-smoke")
abstract class AbstractContainerIntegrationTest {

	@Autowired
	protected JdbcTemplate jdbcTemplate;

	@Autowired
	private RabbitAdmin rabbitAdmin;

	@Autowired
	private ConditionalOrderProperties conditionalOrderProperties;

	@BeforeEach
	void resetInfrastructureState() {
		jdbcTemplate.execute("""
				TRUNCATE TABLE
				  conditional_order_status_events,
				  conditional_orders,
				  trades,
				  holdings,
				  watchlist_items,
				  refresh_tokens,
				  user_accounts,
				  users
				RESTART IDENTITY CASCADE
				""");
		rabbitAdmin.purgeQueue(conditionalOrderProperties.messaging().queue(), true);
	}
}

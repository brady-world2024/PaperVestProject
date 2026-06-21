package com.papervest.integration;

import com.papervest.auth.dto.RegisterRequest;
import com.papervest.auth.service.AuthService;
import com.papervest.conditionalorder.dto.CreateConditionalOrderRequest;
import com.papervest.conditionalorder.model.ConditionalOrderStatusEvent;
import com.papervest.conditionalorder.repository.ConditionalOrderStatusEventRepository;
import com.papervest.conditionalorder.service.ConditionalOrderService;
import com.papervest.conditionalorder.service.ConditionalOrderTransitionService;
import com.papervest.trading.model.Trade;
import com.papervest.trading.model.TradeSide;
import com.papervest.trading.repository.TradeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PostgresIntegrationTest extends AbstractContainerIntegrationTest {

	@Autowired
	private AuthService authService;

	@Autowired
	private ConditionalOrderService conditionalOrderService;

	@Autowired
	private ConditionalOrderTransitionService transitionService;

	@Autowired
	private ConditionalOrderStatusEventRepository statusEventRepository;

	@Autowired
	private TradeRepository tradeRepository;

	@Test
	void flywayMigrationsCreateExpectedPostgresStructures() {
		Integer appliedMigrations = jdbcTemplate.queryForObject(
				"select count(*) from flyway_schema_history where success = true",
				Integer.class
		);
		String metadataColumnType = jdbcTemplate.queryForObject(
				"""
					select udt_name
					from information_schema.columns
					where table_schema = 'public'
					  and table_name = 'conditional_order_status_events'
					  and column_name = 'metadata_json'
					""",
				String.class
		);
		String analyticsMetadataColumnType = jdbcTemplate.queryForObject(
				"""
					select udt_name
					from information_schema.columns
					where table_schema = 'public'
					  and table_name = 'product_analytics_events'
					  and column_name = 'metadata_json'
					""",
				String.class
		);
		Integer executionKeyIndexes = jdbcTemplate.queryForObject(
				"""
					select count(*)
					from pg_indexes
					where schemaname = 'public'
					  and tablename = 'trades'
					  and indexname = 'ux_trades_execution_key'
					""",
				Integer.class
		);
		Integer schedulerIndexes = jdbcTemplate.queryForObject(
				"""
					select count(*)
					from pg_indexes
					where schemaname = 'public'
					  and tablename = 'conditional_orders'
					  and indexname = 'ix_conditional_orders_status_symbol_created_at'
					""",
				Integer.class
		);
		Integer emailTokenIndexes = jdbcTemplate.queryForObject(
				"""
					select count(*)
					from pg_indexes
					where schemaname = 'public'
					  and tablename = 'email_verification_tokens'
					  and indexname = 'ix_email_verification_tokens_user_id'
					""",
				Integer.class
		);
		Integer passwordResetTokenIndexes = jdbcTemplate.queryForObject(
				"""
					select count(*)
					from pg_indexes
					where schemaname = 'public'
					  and tablename = 'password_reset_tokens'
					  and indexname = 'ix_password_reset_tokens_user_id'
				""",
				Integer.class
		);
		Integer portfolioSnapshotIndexes = jdbcTemplate.queryForObject(
				"""
					select count(*)
					from pg_indexes
					where schemaname = 'public'
					  and tablename = 'portfolio_snapshots'
					  and indexname = 'ix_portfolio_snapshots_user_id_created_at'
					""",
				Integer.class
		);
		Integer userNotificationIndexes = jdbcTemplate.queryForObject(
				"""
					select count(*)
					from pg_indexes
					where schemaname = 'public'
					  and tablename = 'user_notifications'
					  and indexname = 'ix_user_notifications_user_id_created_at'
					""",
				Integer.class
		);
		Integer productAnalyticsUserIndexes = jdbcTemplate.queryForObject(
				"""
					select count(*)
					from pg_indexes
					where schemaname = 'public'
					  and tablename = 'product_analytics_events'
					  and indexname = 'ix_product_analytics_events_user_id_created_at'
					""",
				Integer.class
		);
		Integer productAnalyticsEventIndexes = jdbcTemplate.queryForObject(
				"""
					select count(*)
					from pg_indexes
					where schemaname = 'public'
					  and tablename = 'product_analytics_events'
					  and indexname = 'ix_product_analytics_events_event_name_created_at'
					""",
				Integer.class
		);

		assertThat(appliedMigrations).isEqualTo(7);
		assertThat(metadataColumnType).isEqualTo("jsonb");
		assertThat(analyticsMetadataColumnType).isEqualTo("jsonb");
		assertThat(executionKeyIndexes).isEqualTo(1);
		assertThat(schedulerIndexes).isEqualTo(1);
		assertThat(emailTokenIndexes).isEqualTo(1);
		assertThat(passwordResetTokenIndexes).isEqualTo(1);
		assertThat(portfolioSnapshotIndexes).isEqualTo(1);
		assertThat(userNotificationIndexes).isEqualTo(1);
		assertThat(productAnalyticsUserIndexes).isEqualTo(1);
		assertThat(productAnalyticsEventIndexes).isEqualTo(1);
	}

	@Test
	void conditionalOrderStatusMetadataIsStoredAsRealJsonb() {
		UUID userId = registerUserId();
		UUID orderId = UUID.fromString(conditionalOrderService.create(
				userId,
				new CreateConditionalOrderRequest(
						"AAPL",
						TradeSide.BUY,
						new BigDecimal("200.0000"),
						new BigDecimal("1.0000"),
						null
				)
		).id());

		transitionService.markTriggered(
				conditionalOrderService.requireOrder(orderId),
				new BigDecimal("198.2200"),
				Map.of(
						"marketPrice", new BigDecimal("198.2200"),
						"targetPrice", new BigDecimal("200.0000"),
						"checkedAt", "2026-01-02T15:30:00Z"
				)
		);

		ConditionalOrderStatusEvent event = statusEventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(orderId).get(1);
		String metadataType = jdbcTemplate.queryForObject(
				"select jsonb_typeof(metadata_json) from conditional_order_status_events where id = ?",
				String.class,
				event.getId()
		);

		assertThat(metadataType).isEqualTo("object");
		assertThat(event.getMetadataJson()).contains("\"marketPrice\": 198.2200");
		assertThat(event.getMetadataJson()).contains("\"targetPrice\": 200.0000");
	}

	@Test
	void duplicateExecutionKeysAreRejectedByRealPostgresConstraint() {
		UUID userId = registerUserId();

		Trade first = new Trade(
				userId,
				"AAPL",
				"Apple Inc.",
				TradeSide.BUY,
				new BigDecimal("1.0000"),
				new BigDecimal("198.2200"),
				new BigDecimal("198.22"),
				new BigDecimal("0.00"),
				new BigDecimal("99801.78"),
				null,
				"duplicate-execution-key"
		);

		Trade duplicate = new Trade(
				userId,
				"AAPL",
				"Apple Inc.",
				TradeSide.BUY,
				new BigDecimal("1.0000"),
				new BigDecimal("198.2200"),
				new BigDecimal("198.22"),
				new BigDecimal("0.00"),
				new BigDecimal("99603.56"),
				null,
				"duplicate-execution-key"
		);

		tradeRepository.saveAndFlush(first);

		assertThatThrownBy(() -> tradeRepository.saveAndFlush(duplicate))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThat(tradeRepository.findByExecutionKey("duplicate-execution-key")).isPresent();
	}

	private UUID registerUserId() {
		return authService.register(new RegisterRequest(
				"postgres-" + UUID.randomUUID() + "@example.com",
				"SecurePass1",
				"SecurePass1",
				"Postgres Integration Test"
		)).user().id();
	}
}

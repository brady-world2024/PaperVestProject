package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.web.RequestIdFilter;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.reconciliation.model.ReconciliationIssueCode;
import com.papervest.reconciliation.model.ReconciliationReport;
import com.papervest.reconciliation.service.ReconciliationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class ReconciliationServiceIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private ReconciliationService reconciliationService;

	@MockitoBean
	private MarketDataService marketDataService;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		resetState();
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
		when(marketDataService.resolveCompanyName(anyString(), any())).thenReturn("Apple Inc.");
		when(marketDataService.getQuote(anyString(), any())).thenReturn(stockQuote("100.0000"));
	}

	@Test
	void healthyTradeAndPendingReservationsProduceHealthyReport() throws Exception {
		AuthContext auth = register();
		buyAapl(auth.accessToken(), 5);
		createPendingBuy(auth.accessToken(), 1, "99.50");
		createPendingSell(auth.accessToken(), 2, "110.00");

		ReconciliationReport report = reconciliationService.scan();

		assertThat(report.healthy()).isTrue();
		assertThat(report.issues()).isEmpty();
	}

	@Test
	void healthyExternalCashFlowsProduceHealthyReport() throws Exception {
		AuthContext auth = register();
		depositCash(auth.accessToken(), "reconcile-deposit-" + UUID.randomUUID(), "1000.00");
		withdrawCash(auth.accessToken(), "reconcile-withdrawal-" + UUID.randomUUID(), "250.00");

		ReconciliationReport report = reconciliationService.scan();

		assertThat(report.healthy()).isTrue();
		assertThat(report.issues()).isEmpty();
	}

	@Test
	void detectsCashLedgerBalanceMismatch() throws Exception {
		AuthContext auth = register();
		buyAapl(auth.accessToken(), 2);
		jdbcTemplate.update("update user_accounts set cash_balance = ? where user_id = ?", new BigDecimal("123.45"), auth.userId());

		ReconciliationReport report = reconciliationService.scan();

		assertIssue(report, ReconciliationIssueCode.CASH_LEDGER_BALANCE_MISMATCH);
	}

	@Test
	void detectsPositionLedgerQuantityMismatch() throws Exception {
		AuthContext auth = register();
		buyAapl(auth.accessToken(), 5);
		jdbcTemplate.update("update holdings set quantity = ? where user_id = ? and symbol = 'AAPL'", new BigDecimal("3.0000"), auth.userId());

		ReconciliationReport report = reconciliationService.scan();

		assertIssue(report, ReconciliationIssueCode.POSITION_LEDGER_QUANTITY_MISMATCH);
	}

	@Test
	void detectsPendingCashReservationMismatch() throws Exception {
		AuthContext auth = register();
		createPendingBuy(auth.accessToken(), 3, "99.50");
		jdbcTemplate.update("update user_accounts set reserved_cash_balance = ? where user_id = ?", BigDecimal.ZERO, auth.userId());

		ReconciliationReport report = reconciliationService.scan();

		assertIssue(report, ReconciliationIssueCode.PENDING_CASH_RESERVATION_MISMATCH);
	}

	@Test
	void detectsPendingPositionReservationMismatch() throws Exception {
		AuthContext auth = register();
		buyAapl(auth.accessToken(), 5);
		createPendingSell(auth.accessToken(), 2, "110.00");
		jdbcTemplate.update("update holdings set reserved_quantity = ? where user_id = ? and symbol = 'AAPL'", BigDecimal.ZERO, auth.userId());

		ReconciliationReport report = reconciliationService.scan();

		assertIssue(report, ReconciliationIssueCode.PENDING_POSITION_RESERVATION_MISMATCH);
	}

	@Test
	void detectsTerminalOrderWithRetainedReservation() throws Exception {
		AuthContext auth = register();
		UUID orderId = createPendingBuy(auth.accessToken(), 1, "99.50");
		cancelOrder(auth.accessToken(), orderId);
		jdbcTemplate.update("update orders set reserved_cash_amount = ? where id = ?", new BigDecimal("12.34"), orderId);

		ReconciliationReport report = reconciliationService.scan();

		assertIssue(report, ReconciliationIssueCode.TERMINAL_ORDER_RESERVATION_NOT_RELEASED);
	}

	private void assertIssue(ReconciliationReport report, ReconciliationIssueCode code) {
		assertThat(report.healthy()).isFalse();
		assertThat(report.issues()).extracting("code").contains(code);
	}

	private AuthContext register() throws Exception {
		String email = "reconcile-" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Reconciliation Test"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();
		UUID userId = jdbcTemplate.queryForObject("select id from users where email = ?", UUID.class, email);
		return new AuthContext(objectMapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText(), userId);
	}

	private void buyAapl(String token, int quantity) throws Exception {
		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", "reconcile-buy-" + UUID.randomUUID())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": %d
								}
								""".formatted(quantity)))
				.andExpect(status().isOk());
	}

	private void depositCash(String token, String idempotencyKey, String amount) throws Exception {
		mockMvc.perform(post("/api/account/cash-flows/deposits")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", idempotencyKey)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "amount": %s,
								  "memo": "Reconciliation deposit"
								}
								""".formatted(amount)))
				.andExpect(status().isOk());
	}

	private void withdrawCash(String token, String idempotencyKey, String amount) throws Exception {
		mockMvc.perform(post("/api/account/cash-flows/withdrawals")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", idempotencyKey)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "amount": %s,
								  "memo": "Reconciliation withdrawal"
								}
								""".formatted(amount)))
				.andExpect(status().isOk());
	}

	private UUID createPendingBuy(String token, int quantity, String limitPrice) throws Exception {
		return createPendingOrder(token, "BUY", quantity, limitPrice);
	}

	private UUID createPendingSell(String token, int quantity, String limitPrice) throws Exception {
		return createPendingOrder(token, "SELL", quantity, limitPrice);
	}

	private UUID createPendingOrder(String token, String side, int quantity, String limitPrice) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", "reconcile-order-" + UUID.randomUUID())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "%s",
								  "orderType": "LIMIT",
								  "timeInForce": "DAY",
								  "quantity": %d,
								  "limitPrice": %s
								}
								""".formatted(side, quantity, limitPrice)))
				.andExpect(status().isCreated())
				.andReturn();
		JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
		return UUID.fromString(json.path("id").asText());
	}

	private void cancelOrder(String token, UUID orderId) throws Exception {
		mockMvc.perform(post("/api/orders/{orderId}/cancel", orderId)
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk());
	}

	private void resetState() {
		jdbcTemplate.execute("delete from order_execution_requests");
		jdbcTemplate.execute("delete from order_status_events");
		jdbcTemplate.execute("delete from orders");
		jdbcTemplate.execute("delete from cash_ledger_entries");
		jdbcTemplate.execute("delete from position_ledger_entries");
		jdbcTemplate.execute("delete from trades");
		jdbcTemplate.execute("delete from holdings");
		jdbcTemplate.execute("delete from refresh_tokens");
		jdbcTemplate.execute("delete from user_accounts");
		jdbcTemplate.execute("delete from users");
	}

	private StockQuote stockQuote(String price) {
		return new StockQuote(
				"AAPL",
				"Apple Inc.",
				new BigDecimal(price),
				BigDecimal.ZERO,
				BigDecimal.ZERO,
				new BigDecimal("99.0000"),
				new BigDecimal("101.0000"),
				new BigDecimal("98.0000"),
				new BigDecimal("98.5000"),
				Instant.parse("2026-01-02T15:00:00Z"),
				false,
				MarketSessionState.OPEN,
				true,
				"America/New_York"
		);
	}

	private record AuthContext(String accessToken, UUID userId) {
	}
}

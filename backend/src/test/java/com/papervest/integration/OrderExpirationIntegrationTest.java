package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.web.RequestIdFilter;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.orders.execution.model.OrderExecutionRequest;
import com.papervest.orders.execution.model.OrderExecutionRequestStatus;
import com.papervest.orders.execution.repository.OrderExecutionRequestRepository;
import com.papervest.orders.execution.service.OrderExecutionTriggerService;
import com.papervest.orders.service.OrderExpirationService;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class OrderExpirationIntegrationTest {

	private static final Instant EXPIRATION_SCAN_TIME = Instant.parse("2026-01-03T22:00:00Z");

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
	private OrderExpirationService expirationService;

	@Autowired
	private OrderExecutionTriggerService triggerService;

	@Autowired
	private OrderExecutionRequestRepository executionRequestRepository;

	@MockitoBean
	private MarketDataService marketDataService;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		resetOrderState();
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
		when(marketDataService.resolveCompanyName(anyString(), any())).thenReturn("Apple Inc.");
		when(marketDataService.getQuote(anyString(), any())).thenReturn(stockQuote("100.0000"));
	}

	private void resetOrderState() {
		jdbcTemplate.execute("delete from order_execution_requests");
		jdbcTemplate.execute("delete from order_status_events");
		jdbcTemplate.execute("delete from orders");
	}

	@Test
	void dayPendingOrdersReceiveExpirationButGtcOrdersDoNot() throws Exception {
		AuthContext auth = register();

		JsonNode dayOrder = createOrder(auth.accessToken(), "BUY", "LIMIT", "DAY", 2, "101.00");
		JsonNode gtcOrder = createOrder(auth.accessToken(), "BUY", "LIMIT", "GTC", 2, "102.00");

		assertThat(dayOrder.path("expiresAt").asText()).isNotBlank();
		assertThat(gtcOrder.path("expiresAt").isNull()).isTrue();
	}

	@Test
	void dueBuyOrderExpiresAndReleasesReservedCashOnce() throws Exception {
		AuthContext auth = register();
		JsonNode order = createOrder(auth.accessToken(), "BUY", "LIMIT", "DAY", 3, "99.50");
		UUID orderId = UUID.fromString(order.path("id").asText());
		forceExpired(orderId);

		int expired = expirationService.expireDueOrders(EXPIRATION_SCAN_TIME);
		int expiredAgain = expirationService.expireDueOrders(EXPIRATION_SCAN_TIME);

		assertThat(expired).isEqualTo(1);
		assertThat(expiredAgain).isZero();
		assertThat(singleText("select status from orders where id = ?", orderId)).isEqualTo("EXPIRED");
		assertThat(singleMoney("select reserved_cash_amount from orders where id = ?", orderId))
				.isEqualByComparingTo("0.00");
		assertThat(singleMoney("select reserved_cash_balance from user_accounts where user_id = ?", auth.userId()))
				.isEqualByComparingTo("0.00");
		assertThat(singleInt("select count(*) from cash_ledger_entries where order_id = ? and entry_type = 'RELEASE'", orderId))
				.isEqualTo(1);
		assertThat(singleMoney("select amount from cash_ledger_entries where order_id = ? and entry_type = 'RELEASE'", orderId))
				.isEqualByComparingTo("-298.50");
		assertThat(singleText("select reason_code from order_status_events where order_id = ? order by created_at desc limit 1", orderId))
				.isEqualTo("ORDER_EXPIRED");
	}

	@Test
	void dueSellOrderExpiresAndReleasesReservedSharesOnce() throws Exception {
		AuthContext auth = register();
		buyAapl(auth.accessToken(), 5);
		JsonNode order = createOrder(auth.accessToken(), "SELL", "LIMIT", "DAY", 2, "110.00");
		UUID orderId = UUID.fromString(order.path("id").asText());
		forceExpired(orderId);

		int expired = expirationService.expireDueOrders(EXPIRATION_SCAN_TIME);
		int expiredAgain = expirationService.expireDueOrders(EXPIRATION_SCAN_TIME);

		assertThat(expired).isEqualTo(1);
		assertThat(expiredAgain).isZero();
		assertThat(singleText("select status from orders where id = ?", orderId)).isEqualTo("EXPIRED");
		assertThat(singleMoney("select reserved_quantity from orders where id = ?", orderId))
				.isEqualByComparingTo("0.0000");
		assertThat(singleMoney("select reserved_quantity from holdings where user_id = ? and symbol = 'AAPL'", auth.userId()))
				.isEqualByComparingTo("0.0000");
		assertThat(singleInt("select count(*) from position_ledger_entries where order_id = ? and entry_type = 'RELEASE'", orderId))
				.isEqualTo(1);
		assertThat(singleMoney("select quantity_delta from position_ledger_entries where order_id = ? and entry_type = 'RELEASE'", orderId))
				.isEqualByComparingTo("2.0000");
	}

	@Test
	void dueOrderCancelsQueuedExecutionRequest() throws Exception {
		AuthContext auth = register();
		JsonNode order = createOrder(auth.accessToken(), "BUY", "LIMIT", "DAY", 2, "101.00");
		UUID orderId = UUID.fromString(order.path("id").asText());
		assertThat(triggerService.scanAndQueueTriggeredOrders()).isEqualTo(1);
		OrderExecutionRequest request = executionRequestRepository.findByOrderId(orderId).orElseThrow();
		forceExpired(orderId);

		int expired = expirationService.expireDueOrders(EXPIRATION_SCAN_TIME);

		assertThat(expired).isEqualTo(1);
		assertThat(executionRequestRepository.findById(request.getId()).orElseThrow().getStatus())
				.isEqualTo(OrderExecutionRequestStatus.CANCELLED);
		assertThat(singleInt("select count(*) from trades where order_id = ?", orderId)).isZero();
	}

	private JsonNode createOrder(
			String token,
			String side,
			String orderType,
			String timeInForce,
			int quantity,
			String limitPrice
	) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", "expire-order-" + UUID.randomUUID())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "%s",
								  "orderType": "%s",
								  "timeInForce": "%s",
								  "quantity": %d,
								  "limitPrice": %s
								}
								""".formatted(side, orderType, timeInForce, quantity, limitPrice)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("PENDING"))
				.andReturn();
		return objectMapper.readTree(result.getResponse().getContentAsString());
	}

	private void buyAapl(String token, int quantity) throws Exception {
		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", "expire-seed-" + UUID.randomUUID())
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

	private AuthContext register() throws Exception {
		String email = "order-expiration-" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Order Expiration Test"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();
		UUID userId = jdbcTemplate.queryForObject("select id from users where email = ?", UUID.class, email);
		return new AuthContext(objectMapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText(), userId);
	}

	private void forceExpired(UUID orderId) {
		jdbcTemplate.update("update orders set expires_at = ? where id = ?", Instant.parse("2026-01-03T21:00:00Z"), orderId);
	}

	private BigDecimal singleMoney(String sql, Object arg) {
		return jdbcTemplate.queryForObject(sql, BigDecimal.class, arg);
	}

	private int singleInt(String sql, Object arg) {
		return jdbcTemplate.queryForObject(sql, Integer.class, arg);
	}

	private String singleText(String sql, Object arg) {
		return jdbcTemplate.queryForObject(sql, String.class, arg);
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

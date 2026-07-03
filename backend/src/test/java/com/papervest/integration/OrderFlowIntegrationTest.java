package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.web.RequestIdFilter;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class OrderFlowIntegrationTest {

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

	@MockitoBean
	private MarketDataService marketDataService;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();

		when(marketDataService.getQuote(anyString(), any())).thenReturn(stockQuote(new BigDecimal("100.0000")));
		when(marketDataService.resolveCompanyName(anyString(), any())).thenReturn("Apple Inc.");
	}

	@Test
	void marketBuyCreatesFilledOrderAndLedgerAuditTrail() throws Exception {
		String accessToken = registerAndExtractAccessToken();

		MvcResult buyResult = mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + accessToken)
						.header("X-Idempotency-Key", "order-buy-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": 5
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.side").value("BUY"))
				.andExpect(jsonPath("$.orderId").isNotEmpty())
				.andExpect(jsonPath("$.orderStatus").value("FILLED"))
				.andReturn();

		JsonNode buyJson = objectMapper.readTree(buyResult.getResponse().getContentAsString());
		String orderId = buyJson.path("orderId").asText();
		String tradeId = buyJson.path("tradeId").asText();

		mockMvc.perform(get("/api/orders")
						.header("Authorization", "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.orders.length()").value(1))
				.andExpect(jsonPath("$.orders[0].id").value(orderId))
				.andExpect(jsonPath("$.orders[0].status").value("FILLED"))
				.andExpect(jsonPath("$.orders[0].orderType").value("MARKET"))
				.andExpect(jsonPath("$.orders[0].side").value("BUY"))
				.andExpect(jsonPath("$.orders[0].requestedQuantity").value(5.0000))
				.andExpect(jsonPath("$.orders[0].filledQuantity").value(5.0000));

		mockMvc.perform(get("/api/orders/{orderId}", orderId)
						.header("Authorization", "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.order.id").value(orderId))
				.andExpect(jsonPath("$.events.length()").value(3))
				.andExpect(jsonPath("$.events[0].toStatus").value("CREATED"))
				.andExpect(jsonPath("$.events[1].toStatus").value("ACCEPTED"))
				.andExpect(jsonPath("$.events[2].toStatus").value("FILLED"));

		Integer eventCount = jdbcTemplate.queryForObject(
				"select count(*) from order_status_events where order_id = ?",
				Integer.class,
				UUID.fromString(orderId)
		);
		Integer tradeCount = jdbcTemplate.queryForObject(
				"select count(*) from trades where id = ? and order_id = ?",
				Integer.class,
				UUID.fromString(tradeId),
				UUID.fromString(orderId)
		);
		BigDecimal cashLedgerAmount = jdbcTemplate.queryForObject(
				"select amount from cash_ledger_entries where order_id = ? and trade_id = ?",
				BigDecimal.class,
				UUID.fromString(orderId),
				UUID.fromString(tradeId)
		);
		BigDecimal positionLedgerQuantity = jdbcTemplate.queryForObject(
				"select quantity_delta from position_ledger_entries where order_id = ? and trade_id = ?",
				BigDecimal.class,
				UUID.fromString(orderId),
				UUID.fromString(tradeId)
		);

		assertThat(eventCount).isEqualTo(3);
		assertThat(tradeCount).isEqualTo(1);
		assertThat(cashLedgerAmount).isEqualByComparingTo("-500.00");
		assertThat(positionLedgerQuantity).isEqualByComparingTo("5.0000");
	}

	@Test
	void limitBuyOrderReservesCashAndCancelReleasesIt() throws Exception {
		AuthContext auth = registerAndExtractAuthContext();

		MvcResult orderResult = mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "limit-buy-reservation-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "BUY",
								  "orderType": "LIMIT",
								  "timeInForce": "DAY",
								  "quantity": 3,
								  "limitPrice": 99.50
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("PENDING"))
				.andExpect(jsonPath("$.orderType").value("LIMIT"))
				.andExpect(jsonPath("$.reservedCashAmount").value(298.50))
				.andExpect(jsonPath("$.reservedQuantity").value(0.0000))
				.andReturn();

		JsonNode orderJson = objectMapper.readTree(orderResult.getResponse().getContentAsString());
		UUID orderId = UUID.fromString(orderJson.path("id").asText());

		mockMvc.perform(get("/api/orders/{orderId}", orderId)
						.header("Authorization", "Bearer " + auth.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.order.status").value("PENDING"))
				.andExpect(jsonPath("$.events.length()").value(3))
				.andExpect(jsonPath("$.events[0].toStatus").value("CREATED"))
				.andExpect(jsonPath("$.events[1].toStatus").value("ACCEPTED"))
				.andExpect(jsonPath("$.events[2].toStatus").value("PENDING"));

		BigDecimal reservedCash = jdbcTemplate.queryForObject(
				"select reserved_cash_balance from user_accounts where user_id = ?",
				BigDecimal.class,
				auth.userId()
		);
		BigDecimal cashBalance = jdbcTemplate.queryForObject(
				"select cash_balance from user_accounts where user_id = ?",
				BigDecimal.class,
				auth.userId()
		);
		BigDecimal reservationAmount = jdbcTemplate.queryForObject(
				"select amount from cash_ledger_entries where order_id = ? and entry_type = 'RESERVATION'",
				BigDecimal.class,
				orderId
		);
		Integer tradeCount = jdbcTemplate.queryForObject(
				"select count(*) from trades where order_id = ?",
				Integer.class,
				orderId
		);

		assertThat(reservedCash).isEqualByComparingTo("298.50");
		assertThat(cashBalance).isEqualByComparingTo("100000.00");
		assertThat(reservationAmount).isEqualByComparingTo("298.50");
		assertThat(tradeCount).isZero();

		mockMvc.perform(get("/api/portfolio")
						.header("Authorization", "Bearer " + auth.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.summary.cashBalance").value(100000.00))
				.andExpect(jsonPath("$.summary.reservedCashBalance").value(298.50))
				.andExpect(jsonPath("$.summary.availableCashBalance").value(99701.50));

		mockMvc.perform(post("/api/orders/{orderId}/cancel", orderId)
						.header("Authorization", "Bearer " + auth.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELLED"))
				.andExpect(jsonPath("$.reservedCashAmount").value(0.00))
				.andExpect(jsonPath("$.reservedQuantity").value(0.0000))
				.andExpect(jsonPath("$.cancelledAt").isNotEmpty());

		BigDecimal releasedCash = jdbcTemplate.queryForObject(
				"select reserved_cash_balance from user_accounts where user_id = ?",
				BigDecimal.class,
				auth.userId()
		);
		BigDecimal releaseAmount = jdbcTemplate.queryForObject(
				"select amount from cash_ledger_entries where order_id = ? and entry_type = 'RELEASE'",
				BigDecimal.class,
				orderId
		);
		Integer eventCount = jdbcTemplate.queryForObject(
				"select count(*) from order_status_events where order_id = ?",
				Integer.class,
				orderId
		);

		assertThat(releasedCash).isEqualByComparingTo("0.00");
		assertThat(releaseAmount).isEqualByComparingTo("-298.50");
		assertThat(eventCount).isEqualTo(4);
	}

	@Test
	void limitSellOrderReservesSharesAndCancelReleasesThem() throws Exception {
		AuthContext auth = registerAndExtractAuthContext();
		buyAapl(auth.accessToken(), "seed-sell-reservation-holding", 10);

		MvcResult orderResult = mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "limit-sell-reservation-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "SELL",
								  "orderType": "LIMIT",
								  "timeInForce": "DAY",
								  "quantity": 4,
								  "limitPrice": 110.00
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("PENDING"))
				.andExpect(jsonPath("$.reservedCashAmount").value(0.00))
				.andExpect(jsonPath("$.reservedQuantity").value(4.0000))
				.andReturn();

		JsonNode orderJson = objectMapper.readTree(orderResult.getResponse().getContentAsString());
		UUID orderId = UUID.fromString(orderJson.path("id").asText());

		BigDecimal reservedQuantity = jdbcTemplate.queryForObject(
				"select reserved_quantity from holdings where user_id = ? and symbol = 'AAPL'",
				BigDecimal.class,
				auth.userId()
		);
		BigDecimal reservationQuantityDelta = jdbcTemplate.queryForObject(
				"select quantity_delta from position_ledger_entries where order_id = ? and entry_type = 'RESERVATION'",
				BigDecimal.class,
				orderId
		);

		assertThat(reservedQuantity).isEqualByComparingTo("4.0000");
		assertThat(reservationQuantityDelta).isEqualByComparingTo("-4.0000");

		mockMvc.perform(get("/api/portfolio")
						.header("Authorization", "Bearer " + auth.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.holdings[0].quantity").value(10.0000))
				.andExpect(jsonPath("$.holdings[0].reservedQuantity").value(4.0000))
				.andExpect(jsonPath("$.holdings[0].availableQuantity").value(6.0000));

		mockMvc.perform(post("/api/orders/{orderId}/cancel", orderId)
						.header("Authorization", "Bearer " + auth.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELLED"))
				.andExpect(jsonPath("$.reservedCashAmount").value(0.00))
				.andExpect(jsonPath("$.reservedQuantity").value(0.0000));

		BigDecimal releasedQuantity = jdbcTemplate.queryForObject(
				"select reserved_quantity from holdings where user_id = ? and symbol = 'AAPL'",
				BigDecimal.class,
				auth.userId()
		);
		BigDecimal releaseQuantityDelta = jdbcTemplate.queryForObject(
				"select quantity_delta from position_ledger_entries where order_id = ? and entry_type = 'RELEASE'",
				BigDecimal.class,
				orderId
		);

		assertThat(releasedQuantity).isEqualByComparingTo("0.0000");
		assertThat(releaseQuantityDelta).isEqualByComparingTo("4.0000");
	}

	@Test
	void sellOrderCannotReserveSharesAlreadyReservedByAnotherOpenOrder() throws Exception {
		AuthContext auth = registerAndExtractAuthContext();
		buyAapl(auth.accessToken(), "seed-double-reservation-holding", 5);

		mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "limit-sell-reservation-2")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "SELL",
								  "orderType": "LIMIT",
								  "timeInForce": "DAY",
								  "quantity": 5,
								  "limitPrice": 110.00
								}
								"""))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "limit-sell-reservation-3")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "SELL",
								  "orderType": "LIMIT",
								  "timeInForce": "DAY",
								  "quantity": 1,
								  "limitPrice": 111.00
								}
								"""))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.code").value("INSUFFICIENT_SHARES"));

		BigDecimal reservedQuantity = jdbcTemplate.queryForObject(
				"select reserved_quantity from holdings where user_id = ? and symbol = 'AAPL'",
				BigDecimal.class,
				auth.userId()
		);

		assertThat(reservedQuantity).isEqualByComparingTo("5.0000");
	}

	@Test
	void idempotencyKeysCannotReplayAcrossMarketAndPendingOrderEndpoints() throws Exception {
		AuthContext auth = registerAndExtractAuthContext();

		mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "cross-endpoint-key-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "BUY",
								  "orderType": "LIMIT",
								  "timeInForce": "DAY",
								  "quantity": 1,
								  "limitPrice": 95.00
								}
								"""))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "cross-endpoint-key-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": 1
								}
								"""))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_CONFLICT"));

		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "cross-endpoint-key-2")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": 1
								}
								"""))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "cross-endpoint-key-2")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "BUY",
								  "orderType": "LIMIT",
								  "timeInForce": "DAY",
								  "quantity": 1,
								  "limitPrice": 95.00
								}
								"""))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_CONFLICT"));
	}

	private String registerAndExtractAccessToken() throws Exception {
		return registerAndExtractAuthContext().accessToken();
	}

	private AuthContext registerAndExtractAuthContext() throws Exception {
		String email = "orders+" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Order Flow Test"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();

		JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
		UUID userId = jdbcTemplate.queryForObject("select id from users where email = ?", UUID.class, email);
		return new AuthContext(jsonNode.path("accessToken").asText(), userId);
	}

	private void buyAapl(String accessToken, String idempotencyKey, int quantity) throws Exception {
		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + accessToken)
						.header("X-Idempotency-Key", idempotencyKey)
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

	private StockQuote stockQuote(BigDecimal price) {
		return new StockQuote(
				"AAPL",
				"Apple Inc.",
				price,
				new BigDecimal("1.5000"),
				new BigDecimal("1.25"),
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

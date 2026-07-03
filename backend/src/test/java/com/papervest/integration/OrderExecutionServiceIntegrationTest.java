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
import com.papervest.orders.execution.service.OrderExecutionService;
import com.papervest.orders.execution.service.OrderExecutionTriggerService;
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
class OrderExecutionServiceIntegrationTest {

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
	private OrderExecutionTriggerService triggerService;

	@Autowired
	private OrderExecutionRequestRepository requestRepository;

	@Autowired
	private OrderExecutionService executionService;

	@MockitoBean
	private MarketDataService marketDataService;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
		when(marketDataService.resolveCompanyName(anyString(), any())).thenReturn("Apple Inc.");
		when(marketDataService.getQuote(anyString(), any())).thenReturn(stockQuote("99.0000"));
	}

	@Test
	void executesTriggeredBuyOrderAndReleasesReservedCashExactlyOnce() throws Exception {
		AuthContext auth = register();
		UUID orderId = createLimitBuy(auth.accessToken());
		triggerService.scanAndQueueTriggeredOrders();
		OrderExecutionRequest request = requestRepository.findByOrderId(orderId).orElseThrow();
		request.markPublished();
		requestRepository.save(request);

		executionService.executeRequest(request.getId());
		executionService.executeRequest(request.getId());

		assertThat(singleMoney("select reserved_cash_balance from user_accounts where user_id = ?", auth.userId()))
				.isEqualByComparingTo("0.00");
		assertThat(singleMoney("select cash_balance from user_accounts where user_id = ?", auth.userId()))
				.isEqualByComparingTo("99802.00");
		assertThat(singleInt("select count(*) from trades where order_id = ?", orderId)).isEqualTo(1);
		assertThat(singleInt("select count(*) from cash_ledger_entries where order_id = ? and entry_type = 'TRADE_DEBIT'", orderId)).isEqualTo(1);
		assertThat(singleInt("select count(*) from cash_ledger_entries where order_id = ? and entry_type = 'RELEASE'", orderId)).isEqualTo(1);
		assertThat(singleText("select status from orders where id = ?", orderId)).isEqualTo("FILLED");
		assertThat(requestRepository.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(OrderExecutionRequestStatus.CONSUMED);
	}

	@Test
	void cancelledOrderMarksRequestCancelledWithoutFill() throws Exception {
		AuthContext auth = register();
		UUID orderId = createLimitBuy(auth.accessToken());
		triggerService.scanAndQueueTriggeredOrders();
		OrderExecutionRequest request = requestRepository.findByOrderId(orderId).orElseThrow();
		request.markPublished();
		requestRepository.save(request);

		mockMvc.perform(post("/api/orders/{orderId}/cancel", orderId)
						.header("Authorization", "Bearer " + auth.accessToken()))
				.andExpect(status().isOk());

		executionService.executeRequest(request.getId());

		assertThat(singleInt("select count(*) from trades where order_id = ?", orderId)).isZero();
		assertThat(requestRepository.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(OrderExecutionRequestStatus.CANCELLED);
	}

	@Test
	void executesTriggeredSellOrderAndReleasesReservedShares() throws Exception {
		AuthContext auth = register();
		buyAapl(auth.accessToken(), 5);
		UUID orderId = createLimitSell(auth.accessToken());
		triggerService.scanAndQueueTriggeredOrders();
		OrderExecutionRequest request = requestRepository.findByOrderId(orderId).orElseThrow();
		request.markPublished();
		requestRepository.save(request);

		executionService.executeRequest(request.getId());

		assertThat(singleMoney("select cash_balance from user_accounts where user_id = ?", auth.userId()))
				.isEqualByComparingTo("99703.00");
		assertThat(singleMoney("select quantity from holdings where user_id = ? and symbol = 'AAPL'", auth.userId()))
				.isEqualByComparingTo("3.0000");
		assertThat(singleMoney("select reserved_quantity from holdings where user_id = ? and symbol = 'AAPL'", auth.userId()))
				.isEqualByComparingTo("0.0000");
		assertThat(singleInt("select count(*) from trades where order_id = ?", orderId)).isEqualTo(1);
		assertThat(singleInt("select count(*) from position_ledger_entries where order_id = ? and entry_type = 'RELEASE'", orderId)).isEqualTo(1);
		assertThat(requestRepository.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(OrderExecutionRequestStatus.CONSUMED);
	}

	private UUID createLimitBuy(String token) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", "exec-buy-" + UUID.randomUUID())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "BUY",
								  "orderType": "LIMIT",
								  "timeInForce": "DAY",
								  "quantity": 2,
								  "limitPrice": 101.00
								}
								"""))
				.andExpect(status().isCreated())
				.andReturn();
		return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
	}

	private UUID createLimitSell(String token) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", "exec-sell-" + UUID.randomUUID())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "side": "SELL",
								  "orderType": "LIMIT",
								  "timeInForce": "DAY",
								  "quantity": 2,
								  "limitPrice": 98.00
								}
								"""))
				.andExpect(status().isCreated())
				.andReturn();
		return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
	}

	private void buyAapl(String token, int quantity) throws Exception {
		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", "seed-holding-" + UUID.randomUUID())
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
		String email = "order-exec-service-" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Order Execution Service Test"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();
		UUID userId = jdbcTemplate.queryForObject("select id from users where email = ?", UUID.class, email);
		return new AuthContext(objectMapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText(), userId);
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

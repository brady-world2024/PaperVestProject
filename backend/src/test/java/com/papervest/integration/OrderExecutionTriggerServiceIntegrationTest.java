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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
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
class OrderExecutionTriggerServiceIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	@Autowired
	private OrderExecutionTriggerService triggerService;

	@Autowired
	private OrderExecutionRequestRepository executionRequestRepository;

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
		when(marketDataService.getQuote(anyString(), any())).thenReturn(stockQuote("100.0000", true));
	}

	@Test
	void limitBuyTriggerCreatesOnePendingExecutionRequest() throws Exception {
		String token = registerAndExtractAccessToken();
		UUID orderId = createOrder(token, """
				{
				  "symbol": "AAPL",
				  "companyName": "Apple Inc.",
				  "side": "BUY",
				  "orderType": "LIMIT",
				  "timeInForce": "DAY",
				  "quantity": 2,
				  "limitPrice": 101.00
				}
				""");

		int queued = triggerService.scanAndQueueTriggeredOrders();
		int queuedAgain = triggerService.scanAndQueueTriggeredOrders();

		assertThat(queued).isEqualTo(1);
		assertThat(queuedAgain).isZero();
		OrderExecutionRequest request = executionRequestRepository.findByOrderId(orderId).orElseThrow();
		assertThat(request.getStatus()).isEqualTo(OrderExecutionRequestStatus.PENDING);
		assertThat(request.getExecutionPrice()).isEqualByComparingTo("100.0000");
	}

	@Test
	void marketClosedQuoteSkipsTrigger() throws Exception {
		when(marketDataService.getQuote(anyString(), any())).thenReturn(stockQuote("100.0000", false));
		String token = registerAndExtractAccessToken();
		UUID orderId = createOrder(token, """
				{
				  "symbol": "AAPL",
				  "companyName": "Apple Inc.",
				  "side": "BUY",
				  "orderType": "LIMIT",
				  "timeInForce": "DAY",
				  "quantity": 2,
				  "limitPrice": 101.00
				}
				""");

		int queued = triggerService.scanAndQueueTriggeredOrders();

		assertThat(queued).isZero();
		assertThat(executionRequestRepository.findByOrderId(orderId)).isEmpty();
	}

	private UUID createOrder(String token, String body) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + token)
						.header("X-Idempotency-Key", "order-exec-" + UUID.randomUUID())
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isCreated())
				.andReturn();
		JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
		return UUID.fromString(json.path("id").asText());
	}

	private String registerAndExtractAccessToken() throws Exception {
		String email = "order-exec-trigger-" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Order Execution Trigger Test"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();
		return objectMapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText();
	}

	private StockQuote stockQuote(String price, boolean tradingEnabled) {
		return new StockQuote(
				"AAPL",
				"Apple Inc.",
				new BigDecimal(price),
				new BigDecimal("1.5000"),
				new BigDecimal("1.25"),
				new BigDecimal("99.0000"),
				new BigDecimal("101.0000"),
				new BigDecimal("98.0000"),
				new BigDecimal("98.5000"),
				Instant.parse("2026-01-02T15:00:00Z"),
				false,
				tradingEnabled ? MarketSessionState.OPEN : MarketSessionState.CLOSED,
				tradingEnabled,
				"America/New_York"
		);
	}
}

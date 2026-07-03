package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.web.RequestIdFilter;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class OrderExecutionVisibilityIntegrationTest {

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
		when(marketDataService.getQuote(anyString(), any())).thenReturn(stockQuote("100.0000"));
	}

	@Test
	void orderApisExposeExecutionSummaryAfterPendingOrderTriggers() throws Exception {
		String accessToken = registerAndExtractAccessToken();
		UUID orderId = createLimitBuy(accessToken);

		int queued = triggerService.scanAndQueueTriggeredOrders();

		assertThat(queued).isEqualTo(1);

		MvcResult listResult = mockMvc.perform(get("/api/orders")
						.header("Authorization", "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andReturn();
		JsonNode listedOrder = objectMapper.readTree(listResult.getResponse().getContentAsString())
				.path("orders")
				.get(0);

		assertThat(listedOrder.path("id").asText()).isEqualTo(orderId.toString());
		assertThat(listedOrder.path("execution").isMissingNode()).isFalse();
		assertThat(listedOrder.path("execution").path("id").asText()).isNotBlank();
		assertThat(listedOrder.path("execution").path("status").asText()).isEqualTo("PENDING");
		assertThat(listedOrder.path("execution").path("triggerPrice").decimalValue()).isEqualByComparingTo("100.0000");
		assertThat(listedOrder.path("execution").path("executionPrice").decimalValue()).isEqualByComparingTo("100.0000");
		assertThat(listedOrder.path("execution").path("publishAttemptCount").asInt()).isZero();
		assertThat(listedOrder.path("execution").path("publishedAt").isNull()).isTrue();
		assertThat(listedOrder.path("execution").path("consumedAt").isNull()).isTrue();
		assertThat(listedOrder.path("execution").path("createdAt").asText()).isNotBlank();
		assertThat(listedOrder.path("execution").path("updatedAt").asText()).isNotBlank();

		MvcResult detailResult = mockMvc.perform(get("/api/orders/{orderId}", orderId)
						.header("Authorization", "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andReturn();
		JsonNode detailJson = objectMapper.readTree(detailResult.getResponse().getContentAsString());

		assertThat(detailJson.path("order").path("execution").path("status").asText()).isEqualTo("PENDING");
		assertThat(detailJson.path("events")).hasSize(4);
		assertThat(detailJson.path("events").get(3).path("reasonCode").asText()).isEqualTo("ORDER_EXECUTION_QUEUED");
	}

	private UUID createLimitBuy(String accessToken) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/orders")
						.header("Authorization", "Bearer " + accessToken)
						.header("X-Idempotency-Key", "order-exec-visibility-" + UUID.randomUUID())
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

	private String registerAndExtractAccessToken() throws Exception {
		String email = "order-exec-visibility-" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Order Execution Visibility Test"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();
		return objectMapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText();
	}

	private StockQuote stockQuote(String price) {
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
				MarketSessionState.OPEN,
				true,
				"America/New_York"
		);
	}
}

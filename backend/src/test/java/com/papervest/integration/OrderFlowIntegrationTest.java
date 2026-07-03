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

	private String registerAndExtractAccessToken() throws Exception {
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
		return jsonNode.path("accessToken").asText();
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
}

package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.web.RequestIdFilter;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.StockHistoryRange;
import com.papervest.marketdata.model.StockPriceBar;
import com.papervest.marketdata.model.StockPriceHistory;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class TradingFlowIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	private MockMvc mockMvc;

	@MockitoBean
	private MarketDataService marketDataService;

	private StockQuote aaplQuote;
	private StockPriceHistory aaplHistory;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();

		aaplQuote = new StockQuote(
				"AAPL",
				"Apple Inc.",
				new BigDecimal("100.0000"),
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

		aaplHistory = new StockPriceHistory(
				"AAPL",
				StockHistoryRange.ONE_MONTH,
				"1d",
				Instant.parse("2025-12-01T00:00:00Z"),
				Instant.parse("2025-12-31T00:00:00Z"),
				List.of(
						new StockPriceBar(
								Instant.parse("2025-12-10T00:00:00Z"),
								new BigDecimal("99.0000"),
								new BigDecimal("101.0000"),
								new BigDecimal("98.5000"),
								new BigDecimal("100.0000"),
								12000000L
						)
				)
		);

		when(marketDataService.getQuote(anyString(), any())).thenReturn(aaplQuote);
		when(marketDataService.getPriceHistory(anyString(), any())).thenReturn(aaplHistory);
		when(marketDataService.resolveCompanyName(anyString(), any())).thenReturn("Apple Inc.");
		when(marketDataService.getQuotes(any())).thenAnswer(invocation -> {
			List<?> requests = invocation.getArgument(0);
			return requests.stream().map(ignored -> aaplQuote).toList();
		});
	}

	@Test
	void registerWatchlistTradePortfolioAndHistoryFlow() throws Exception {
		String accessToken = registerAndExtractAccessToken();

		mockMvc.perform(post("/api/watchlist")
						.header("Authorization", "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc."
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.symbol").value("AAPL"));

		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + accessToken)
						.header("X-Idempotency-Key", "buy-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": 10
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.side").value("BUY"))
				.andExpect(jsonPath("$.grossAmount").value(1000.00));

		mockMvc.perform(get("/api/portfolio")
						.header("Authorization", "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.summary.cashBalance").value(99000.00))
				.andExpect(jsonPath("$.holdings[0].symbol").value("AAPL"))
				.andExpect(jsonPath("$.holdings[0].quantity").value(10.0000));

		mockMvc.perform(post("/api/trades/sell")
						.header("Authorization", "Bearer " + accessToken)
						.header("X-Idempotency-Key", "sell-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": 4
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.side").value("SELL"));

		mockMvc.perform(get("/api/trades/history")
						.header("Authorization", "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.trades.length()").value(2));

		mockMvc.perform(delete("/api/watchlist/AAPL")
						.header("Authorization", "Bearer " + accessToken))
				.andExpect(status().isNoContent());
	}

	@Test
	void authenticatedMarketHistoryEndpointReturnsChartSeries() throws Exception {
		String accessToken = registerAndExtractAccessToken();

		mockMvc.perform(get("/api/market/stocks/AAPL/history")
						.header("Authorization", "Bearer " + accessToken)
						.param("range", "1M"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.symbol").value("AAPL"))
				.andExpect(jsonPath("$.range").value("1M"))
				.andExpect(jsonPath("$.interval").value("1d"))
				.andExpect(jsonPath("$.points[0].closePrice").value(100.0000));
	}

	@Test
	void authenticatedTradeEndpointRejectsOrdersWhenMarketIsClosed() throws Exception {
		String accessToken = registerAndExtractAccessToken();
		when(marketDataService.getQuote("AAPL", "Apple Inc.")).thenReturn(closedQuote());

		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + accessToken)
						.header("X-Idempotency-Key", "buy-closed")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": 1
								}
								"""))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.code").value("MARKET_CLOSED"))
				.andExpect(jsonPath("$.message").value("Paper trading is only available during regular market hours"));
	}

	private String registerAndExtractAccessToken() throws Exception {
		String email = "alice+" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Integration Test iPhone"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();

		JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
		return jsonNode.path("accessToken").asText();
	}

	private StockQuote closedQuote() {
		return new StockQuote(
				"AAPL",
				"Apple Inc.",
				new BigDecimal("100.0000"),
				new BigDecimal("1.5000"),
				new BigDecimal("1.25"),
				new BigDecimal("99.0000"),
				new BigDecimal("101.0000"),
				new BigDecimal("98.0000"),
				new BigDecimal("98.5000"),
				Instant.parse("2026-01-02T22:10:00Z"),
				false,
				MarketSessionState.AFTER_HOURS,
				false,
				"America/New_York"
		);
	}
}

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
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class PortfolioPerformanceIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

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
		when(marketDataService.getQuotes(any())).thenAnswer(invocation -> {
			List<?> requests = invocation.getArgument(0);
			return requests.stream().map(ignored -> stockQuote(new BigDecimal("100.0000"))).toList();
		});
		when(marketDataService.resolveCompanyName(anyString(), any())).thenReturn("Apple Inc.");
	}

	@Test
	void authenticatedUserCanLoadPortfolioPerformance() throws Exception {
		String accessToken = registerAndExtractAccessToken();

		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + accessToken)
						.header("X-Idempotency-Key", "performance-buy-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": 10
								}
								"""))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/portfolio/performance")
						.header("Authorization", "Bearer " + accessToken)
						.param("range", "1M"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.range").value("1M"))
				.andExpect(jsonPath("$.status").value("INSUFFICIENT_HISTORY"))
				.andExpect(jsonPath("$.summary.currentValue").value(100000.00))
				.andExpect(jsonPath("$.summary.startValue").value(100000.00))
				.andExpect(jsonPath("$.summary.absoluteReturn").value(0.00))
				.andExpect(jsonPath("$.summary.returnPercent").value(0.00))
				.andExpect(jsonPath("$.summary.maxDrawdownPercent").value(0.00))
				.andExpect(jsonPath("$.allocation.cashPercent").value(99.00))
				.andExpect(jsonPath("$.allocation.holdingsPercent").value(1.00))
				.andExpect(jsonPath("$.pnlContribution.realizedValue").value(0.00))
				.andExpect(jsonPath("$.topHoldings[0].symbol").value("AAPL"))
				.andExpect(jsonPath("$.points.length()").value(2));
	}

	private String registerAndExtractAccessToken() throws Exception {
		String email = "performance+" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Portfolio Performance Test"
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

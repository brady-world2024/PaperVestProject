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
import org.springframework.jdbc.core.JdbcTemplate;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.admin.bootstrap-emails=admin@example.com")
@ActiveProfiles("test")
class ProductAnalyticsIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	@Autowired
	private ObjectMapper objectMapper;

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
		resetDatabaseState();

		when(marketDataService.getQuote(anyString(), any())).thenReturn(new StockQuote(
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
		));
	}

	@Test
	void adminOverviewAggregatesDomainAndBrowserSignals() throws Exception {
		RegisteredSession admin = registerSession("admin@example.com", "SecurePass1");
		RegisteredSession member = registerSession("member+" + UUID.randomUUID() + "@example.com", "SecurePass1");
		AuthenticatedSession memberLogin = loginSession(member.email(), "SecurePass1");

		mockMvc.perform(post("/api/analytics/events")
						.header("Authorization", "Bearer " + memberLogin.accessToken())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "eventName": "PAGE_VIEWED",
								  "path": "/dashboard"
								}
								"""))
				.andExpect(status().isNoContent());

		mockMvc.perform(post("/api/analytics/events")
						.header("Authorization", "Bearer " + memberLogin.accessToken())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "eventName": "STOCK_SEARCH_PERFORMED",
								  "path": "/dashboard",
								  "metadata": {
								    "queryLength": 4,
								    "resultsCount": 2
								  }
								}
								"""))
				.andExpect(status().isNoContent());

		mockMvc.perform(post("/api/watchlist")
						.header("Authorization", "Bearer " + memberLogin.accessToken())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc."
								}
								"""))
				.andExpect(status().isCreated());

		mockMvc.perform(delete("/api/watchlist/AAPL")
						.header("Authorization", "Bearer " + memberLogin.accessToken()))
				.andExpect(status().isNoContent());

		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + memberLogin.accessToken())
						.header("X-Idempotency-Key", "analytics-buy-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": 1
								}
								"""))
				.andExpect(status().isOk());

		MvcResult createdOrder = mockMvc.perform(post("/api/conditional-orders")
						.header("Authorization", "Bearer " + memberLogin.accessToken())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "side": "BUY",
								  "targetPrice": 95,
								  "quantity": 3
								}
								"""))
				.andExpect(status().isCreated())
				.andReturn();

		String orderId = objectMapper.readTree(createdOrder.getResponse().getContentAsString()).path("id").asText();

		mockMvc.perform(post("/api/conditional-orders/{orderId}/cancel", orderId)
						.header("Authorization", "Bearer " + memberLogin.accessToken()))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/admin/analytics/overview")
						.header("Authorization", "Bearer " + admin.accessToken())
						.param("days", "30"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.summary.totalEvents").value(10))
				.andExpect(jsonPath("$.summary.uniqueUsers").value(2))
				.andExpect(jsonPath("$.summary.pageViews").value(1))
				.andExpect(jsonPath("$.summary.stockSearches").value(1))
				.andExpect(jsonPath("$.summary.registrations").value(2))
				.andExpect(jsonPath("$.summary.logins").value(1))
				.andExpect(jsonPath("$.summary.tradesExecuted").value(1))
				.andExpect(jsonPath("$.summary.conditionalOrdersCreated").value(1))
				.andExpect(jsonPath("$.summary.conditionalOrdersCancelled").value(1))
				.andExpect(jsonPath("$.summary.watchlistAdds").value(1))
				.andExpect(jsonPath("$.summary.watchlistRemovals").value(1))
				.andExpect(jsonPath("$.topPages[0].path").value("/dashboard"))
				.andExpect(jsonPath("$.topPages[0].views").value(1))
				.andExpect(jsonPath("$.eventBreakdown[0].eventName").value("USER_REGISTERED"))
				.andExpect(jsonPath("$.eventBreakdown[0].count").value(2))
				.andExpect(jsonPath("$.funnel.usersSeen").value(2))
				.andExpect(jsonPath("$.funnel.usersWithPageViews").value(1))
				.andExpect(jsonPath("$.funnel.usersWithSearches").value(1))
				.andExpect(jsonPath("$.funnel.usersWithWatchlistActivity").value(1))
				.andExpect(jsonPath("$.funnel.usersWithTrades").value(1))
				.andExpect(jsonPath("$.funnel.usersWithConditionalOrders").value(1))
				.andExpect(jsonPath("$.dailyActivity[0].totalEvents").value(10))
				.andExpect(jsonPath("$.dailyActivity[0].pageViews").value(1))
				.andExpect(jsonPath("$.dailyActivity[0].stockSearches").value(1))
				.andExpect(jsonPath("$.dailyActivity[0].tradesExecuted").value(1))
				.andExpect(jsonPath("$.dailyActivity[0].conditionalOrdersCreated").value(1));
	}

	@Test
	void webAnalyticsEndpointRejectsBackendOwnedEventNames() throws Exception {
		RegisteredSession member = registerSession("member+" + UUID.randomUUID() + "@example.com", "SecurePass1");

		mockMvc.perform(post("/api/analytics/events")
						.header("Authorization", "Bearer " + member.accessToken())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "eventName": "TRADE_EXECUTED",
								  "path": "/stocks/AAPL"
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("ANALYTICS_EVENT_NOT_ALLOWED"));
	}

	@Test
	void nonAdminCannotAccessAnalyticsOverview() throws Exception {
		RegisteredSession member = registerSession("member+" + UUID.randomUUID() + "@example.com", "SecurePass1");

		mockMvc.perform(get("/api/admin/analytics/overview")
						.header("Authorization", "Bearer " + member.accessToken())
						.param("days", "30"))
				.andExpect(status().isForbidden());
	}

	private RegisteredSession registerSession(String email, String password) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "%s",
								  "confirmPassword": "%s",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(email, password, password)))
				.andExpect(status().isCreated())
				.andReturn();

		JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
		return new RegisteredSession(
				body.path("user").path("email").asText(),
				body.path("accessToken").asText()
		);
	}

	private AuthenticatedSession loginSession(String email, String password) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "%s",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(email, password)))
				.andExpect(status().isOk())
				.andReturn();

		JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
		return new AuthenticatedSession(body.path("accessToken").asText());
	}

	private record RegisteredSession(
			String email,
			String accessToken
	) {
	}

	private record AuthenticatedSession(
			String accessToken
	) {
	}

	private void resetDatabaseState() {
		jdbcTemplate.execute("delete from conditional_order_status_events");
		jdbcTemplate.execute("delete from conditional_orders");
		jdbcTemplate.execute("delete from portfolio_snapshots");
		jdbcTemplate.execute("delete from trades");
		jdbcTemplate.execute("delete from holdings");
		jdbcTemplate.execute("delete from watchlist_items");
		jdbcTemplate.execute("delete from user_notifications");
		jdbcTemplate.execute("delete from product_analytics_events");
		jdbcTemplate.execute("delete from refresh_tokens");
		jdbcTemplate.execute("delete from password_reset_tokens");
		jdbcTemplate.execute("delete from email_verification_tokens");
		jdbcTemplate.execute("delete from user_accounts");
		jdbcTemplate.execute("delete from users");
	}
}

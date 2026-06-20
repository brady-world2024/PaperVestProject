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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.admin.bootstrap-emails=admin@example.com")
@ActiveProfiles("test")
class AdminSupportIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	@Autowired
	private ObjectMapper objectMapper;

	@MockitoBean
	private MarketDataService marketDataService;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();

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
	void bootstrapAdminCanSearchUsersAndInspectSupportDetail() throws Exception {
		RegisteredSession admin = registerSession("admin@example.com", "SecurePass1");
		assertThat(admin.role()).isEqualTo("ADMIN");

		RegisteredSession member = registerSession("member+" + UUID.randomUUID() + "@example.com", "SecurePass1");

		mockMvc.perform(post("/api/watchlist")
						.header("Authorization", "Bearer " + member.accessToken())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc."
								}
								"""))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/trades/buy")
						.header("Authorization", "Bearer " + member.accessToken())
						.header("X-Idempotency-Key", "support-buy-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "companyName": "Apple Inc.",
								  "quantity": 1
								}
								"""))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/conditional-orders")
						.header("Authorization", "Bearer " + member.accessToken())
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
				.andExpect(jsonPath("$.status").value("ACTIVE"));

		mockMvc.perform(get("/api/admin/support/users")
						.header("Authorization", "Bearer " + admin.accessToken())
						.param("query", "member"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users[0].email").value(member.email()))
				.andExpect(jsonPath("$.users[0].role").value("USER"))
				.andExpect(jsonPath("$.users[0].holdingsCount").value(1))
				.andExpect(jsonPath("$.users[0].watchlistCount").value(1))
				.andExpect(jsonPath("$.users[0].activeConditionalOrdersCount").value(1))
				.andExpect(jsonPath("$.users[0].activeSessionsCount").value(1))
				.andExpect(jsonPath("$.users[0].unreadNotificationsCount").value(1));

		mockMvc.perform(get("/api/admin/support/users/{userId}", member.userId())
						.header("Authorization", "Bearer " + admin.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").value(member.email()))
				.andExpect(jsonPath("$.user.role").value("USER"))
				.andExpect(jsonPath("$.account.cashBalance").value(99900.00))
				.andExpect(jsonPath("$.holdingsCount").value(1))
				.andExpect(jsonPath("$.watchlistCount").value(1))
				.andExpect(jsonPath("$.activeConditionalOrdersCount").value(1))
				.andExpect(jsonPath("$.activeSessionsCount").value(1))
				.andExpect(jsonPath("$.unreadNotificationsCount").value(1))
				.andExpect(jsonPath("$.holdings[0].symbol").value("AAPL"))
				.andExpect(jsonPath("$.watchlist[0].symbol").value("AAPL"))
				.andExpect(jsonPath("$.recentTrades[0].symbol").value("AAPL"))
				.andExpect(jsonPath("$.activeConditionalOrders[0].status").value("ACTIVE"))
				.andExpect(jsonPath("$.recentNotifications[0].type").value("CONDITIONAL_ORDER_CREATED"));
	}

	@Test
	void nonAdminCannotAccessSupportEndpoints() throws Exception {
		RegisteredSession member = registerSession("member+" + UUID.randomUUID() + "@example.com", "SecurePass1");

		mockMvc.perform(get("/api/admin/support/users")
						.header("Authorization", "Bearer " + member.accessToken()))
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
				body.path("user").path("id").asText(),
				body.path("user").path("email").asText(),
				body.path("user").path("role").asText(),
				body.path("accessToken").asText()
		);
	}

	private record RegisteredSession(
			String userIdRaw,
			String email,
			String role,
			String accessToken
	) {
		UUID userId() {
			return UUID.fromString(userIdRaw);
		}
	}
}

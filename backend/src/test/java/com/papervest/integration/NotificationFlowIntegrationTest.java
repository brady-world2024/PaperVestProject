package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.auth.model.EmailVerificationToken;
import com.papervest.auth.model.PasswordResetToken;
import com.papervest.auth.repository.EmailVerificationTokenRepository;
import com.papervest.auth.repository.PasswordResetTokenRepository;
import com.papervest.common.util.TokenHashingUtils;
import com.papervest.common.web.RequestIdFilter;
import com.papervest.conditionalorder.messaging.ConditionalOrderMessagePublisher;
import com.papervest.conditionalorder.model.ConditionalOrder;
import com.papervest.conditionalorder.repository.ConditionalOrderRepository;
import com.papervest.conditionalorder.service.ConditionalOrderExecutionService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class NotificationFlowIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private ConditionalOrderRepository conditionalOrderRepository;

	@Autowired
	private ConditionalOrderExecutionService conditionalOrderExecutionService;

	@Autowired
	private EmailVerificationTokenRepository emailVerificationTokenRepository;

	@Autowired
	private PasswordResetTokenRepository passwordResetTokenRepository;

	@MockitoBean
	private MarketDataService marketDataService;

	@MockitoBean
	private ConditionalOrderMessagePublisher messagePublisher;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
		reset(marketDataService, messagePublisher);
	}

	@Test
	void conditionalOrderNotificationsAndReadOperationsWork() throws Exception {
		RegisteredSession session = registerSession("notifications+" + UUID.randomUUID() + "@example.com", "SecurePass1");
		String orderId = createConditionalOrder(session.accessToken());

		MvcResult afterCreate = mockMvc.perform(get("/api/notifications")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unreadCount").value(1))
				.andExpect(jsonPath("$.notifications[0].type").value("CONDITIONAL_ORDER_CREATED"))
				.andReturn();

		mockMvc.perform(post("/api/conditional-orders/{id}/cancel", orderId)
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk());

		MvcResult afterCancel = mockMvc.perform(get("/api/notifications")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unreadCount").value(2))
				.andExpect(jsonPath("$.notifications[0].type").value("CONDITIONAL_ORDER_CANCELLED"))
				.andReturn();

		String latestNotificationId = objectMapper.readTree(afterCancel.getResponse().getContentAsString())
				.path("notifications")
				.path(0)
				.path("id")
				.asText();

		mockMvc.perform(post("/api/notifications/{id}/read", latestNotificationId)
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(latestNotificationId))
				.andExpect(jsonPath("$.read").value(true));

		mockMvc.perform(get("/api/notifications")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unreadCount").value(1));

		mockMvc.perform(post("/api/notifications/read-all")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/notifications")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unreadCount").value(0));

		assertThat(objectMapper.readTree(afterCreate.getResponse().getContentAsString()).path("notifications"))
				.hasSize(1);
	}

	@Test
	void accountLifecycleNotificationsAreVisibleAfterVerificationAndPasswordChanges() throws Exception {
		RegisteredSession session = registerSession("lifecycle+" + UUID.randomUUID() + "@example.com", "SecurePass1");

		String verificationToken = "known-email-token";
		emailVerificationTokenRepository.save(new EmailVerificationToken(
				session.userId(),
				TokenHashingUtils.sha256(verificationToken),
				Instant.now().plusSeconds(3600)
		));

		mockMvc.perform(post("/api/auth/email-verification/confirm")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "token": "%s"
								}
								""".formatted(verificationToken)))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/account/change-password")
						.header("Authorization", "Bearer " + session.accessToken())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "currentPassword": "SecurePass1",
								  "newPassword": "StrongerPass2",
								  "confirmNewPassword": "StrongerPass2",
								  "deviceName": "PaperVest Web"
								}
								"""))
				.andExpect(status().isOk());

		MvcResult result = mockMvc.perform(get("/api/notifications")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unreadCount").value(2))
				.andReturn();

		List<String> notificationTypes = extractNotificationTypes(result);
		assertThat(notificationTypes)
				.contains("EMAIL_VERIFIED", "PASSWORD_CHANGED");
	}

	@Test
	void triggeredAndFilledConditionalOrdersCreateOperationalNotifications() throws Exception {
		RegisteredSession session = registerSession("triggered+" + UUID.randomUUID() + "@example.com", "SecurePass1");
		String orderId = createConditionalOrder(session.accessToken());
		ConditionalOrder order = conditionalOrderRepository.findById(UUID.fromString(orderId)).orElseThrow();

		when(marketDataService.getQuote("AAPL", null)).thenReturn(stockQuote("95.0000"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();
		conditionalOrderExecutionService.handleTriggeredOrder(order.getId());

		MvcResult result = mockMvc.perform(get("/api/notifications")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andReturn();

		List<String> notificationTypes = extractNotificationTypes(result);
		assertThat(notificationTypes)
				.contains(
						"CONDITIONAL_ORDER_CREATED",
						"CONDITIONAL_ORDER_TRIGGERED",
						"CONDITIONAL_ORDER_FILLED"
				);
	}

	@Test
	void passwordResetCreatesNotificationVisibleAfterNewLogin() throws Exception {
		RegisteredSession session = registerSession("reset-notification+" + UUID.randomUUID() + "@example.com", "SecurePass1");

		String resetToken = "known-reset-token";
		passwordResetTokenRepository.save(new PasswordResetToken(
				session.userId(),
				TokenHashingUtils.sha256(resetToken),
				Instant.now().plusSeconds(3600)
		));

		mockMvc.perform(post("/api/auth/password-reset/confirm")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "token": "%s",
								  "password": "ResetPass2",
								  "confirmPassword": "ResetPass2"
								}
								""".formatted(resetToken)))
				.andExpect(status().isNoContent());

		RegisteredSession refreshedSession = loginSession(session.email(), "ResetPass2");

		mockMvc.perform(get("/api/notifications")
						.header("Authorization", "Bearer " + refreshedSession.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unreadCount").value(1))
				.andExpect(jsonPath("$.notifications[0].type").value("PASSWORD_CHANGED"));
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

		return parseSession(result);
	}

	private RegisteredSession loginSession(String email, String password) throws Exception {
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

		return parseSession(result);
	}

	private RegisteredSession parseSession(MvcResult result) throws Exception {
		JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
		return new RegisteredSession(
				body.path("user").path("id").asText(),
				body.path("user").path("email").asText(),
				body.path("accessToken").asText()
		);
	}

	private String createConditionalOrder(String accessToken) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/conditional-orders")
						.header("Authorization", "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "side": "BUY",
								  "targetPrice": 100,
								  "quantity": 3
								}
								"""))
				.andExpect(status().isCreated())
				.andReturn();

		return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
	}

	private List<String> extractNotificationTypes(MvcResult result) throws Exception {
		return objectMapper.readTree(result.getResponse().getContentAsString())
				.path("notifications")
				.findValuesAsText("type");
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

	private record RegisteredSession(
			String userIdRaw,
			String email,
			String accessToken
	) {
		UUID userId() {
			return UUID.fromString(userIdRaw);
		}
	}
}

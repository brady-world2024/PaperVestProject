package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.auth.model.EmailVerificationToken;
import com.papervest.auth.model.PasswordResetToken;
import com.papervest.auth.repository.EmailVerificationTokenRepository;
import com.papervest.auth.repository.PasswordResetTokenRepository;
import com.papervest.common.util.TokenHashingUtils;
import com.papervest.common.web.RequestIdFilter;
import com.papervest.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class AccountLifecycleIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private EmailVerificationTokenRepository emailVerificationTokenRepository;

	@Autowired
	private PasswordResetTokenRepository passwordResetTokenRepository;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
	}

	@Test
	void accountProfileAndVerificationFlowWorkAcrossProtectedAndPublicEndpoints() throws Exception {
		RegisteredSession session = registerSession("verify+" + UUID.randomUUID() + "@example.com", "SecurePass1");

		mockMvc.perform(get("/api/account")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(session.email()))
				.andExpect(jsonPath("$.emailVerified").value(false));

		assertThat(emailVerificationTokenRepository.findAllByUserIdAndConsumedAtIsNull(session.userId())).hasSize(1);

		mockMvc.perform(post("/api/account/email-verification")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isNoContent());

		assertThat(emailVerificationTokenRepository.findAllByUserIdAndConsumedAtIsNull(session.userId())).hasSize(1);
		assertThat(emailVerificationTokenRepository.findAll().stream()
				.filter(token -> token.getUserId().equals(session.userId())))
				.hasSize(2);

		String rawToken = "known-email-token";
		emailVerificationTokenRepository.save(new EmailVerificationToken(
				session.userId(),
				TokenHashingUtils.sha256(rawToken),
				Instant.now().plusSeconds(3600)
		));

		mockMvc.perform(post("/api/auth/email-verification/confirm")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "token": "%s"
								}
								""".formatted(rawToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(session.email()))
				.andExpect(jsonPath("$.emailVerifiedAt").isNotEmpty());

		mockMvc.perform(get("/api/account")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.emailVerified").value(true))
				.andExpect(jsonPath("$.emailVerifiedAt").isNotEmpty());
	}

	@Test
	void authenticatedChangePasswordRejectsOldCredentialsAndAllowsNewLogin() throws Exception {
		RegisteredSession session = registerSession("change+" + UUID.randomUUID() + "@example.com", "SecurePass1");

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
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").value(session.email()));

		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(session.email())))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "StrongerPass2",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(session.email())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").value(session.email()));
	}

	@Test
	void passwordResetConfirmationUpdatesPasswordAndRejectsOldLogin() throws Exception {
		RegisteredSession session = registerSession("reset+" + UUID.randomUUID() + "@example.com", "SecurePass1");

		String rawToken = "known-reset-token";
		passwordResetTokenRepository.save(new PasswordResetToken(
				session.userId(),
				TokenHashingUtils.sha256(rawToken),
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
								""".formatted(rawToken)))
				.andExpect(status().isNoContent());

		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(session.email())))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "ResetPass2",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(session.email())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").value(session.email()));
	}

	@Test
	void deletingAccountRemovesUserAndPreventsFutureLogin() throws Exception {
		RegisteredSession session = registerSession("delete+" + UUID.randomUUID() + "@example.com", "SecurePass1");

		mockMvc.perform(delete("/api/account")
						.header("Authorization", "Bearer " + session.accessToken())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "currentPassword": "SecurePass1"
								}
								"""))
				.andExpect(status().isNoContent());

		assertThat(userRepository.findById(session.userId())).isEmpty();

		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(session.email())))
				.andExpect(status().isUnauthorized());
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
				body.path("accessToken").asText()
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

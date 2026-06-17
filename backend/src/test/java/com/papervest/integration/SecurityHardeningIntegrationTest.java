package com.papervest.integration;

import com.papervest.common.web.RequestIdFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
		"app.security.auth-rate-limit.enabled=true",
		"app.security.auth-rate-limit.window=PT5M",
		"app.security.auth-rate-limit.login-max-attempts=3",
		"app.security.auth-rate-limit.register-max-attempts=2",
		"app.security.auth-rate-limit.password-reset-request-max-attempts=2",
		"app.security.auth-rate-limit.password-reset-confirm-max-attempts=2",
		"app.security.auth-rate-limit.email-verification-confirm-max-attempts=2"
})
@ActiveProfiles("test")
class SecurityHardeningIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
	}

	@Test
	void apiResponsesIncludeBaselineSecurityHeaders() throws Exception {
		mockMvc.perform(get("/api/auth/csrf"))
				.andExpect(status().isNoContent())
				.andExpect(header().string("X-Content-Type-Options", "nosniff"))
				.andExpect(header().string("X-Frame-Options", "DENY"))
				.andExpect(header().string("Referrer-Policy", "no-referrer"))
				.andExpect(header().string("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=()"))
				.andExpect(header().string("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"));
	}

	@Test
	void repeatedLoginAttemptsAreRateLimited() throws Exception {
		for (int attempt = 0; attempt < 3; attempt += 1) {
			mockMvc.perform(post("/api/auth/login")
							.contentType(MediaType.APPLICATION_JSON)
							.header("X-Forwarded-For", "203.0.113.15")
							.content("""
									{
									  "email": "nobody@example.com",
									  "password": "SecurePass1",
									  "deviceName": "PaperVest Web"
									}
									"""))
					.andExpect(status().isUnauthorized());
		}

		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.header("X-Forwarded-For", "203.0.113.15")
						.content("""
								{
								  "email": "nobody@example.com",
								  "password": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								"""))
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists("Retry-After"))
				.andExpect(jsonPath("$.code").value("RATE_LIMITED"))
				.andExpect(jsonPath("$.message").value("Too many login attempts. Try again later."));
	}
}

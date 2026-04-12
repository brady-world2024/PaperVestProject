package com.papervest.integration;

import com.papervest.common.web.RequestIdFilter;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class WebCookieAuthIntegrationTest {

	private static final String WEB_ORIGIN = "http://localhost:3000";

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
	void registerRefreshSessionAndLogoutWorkWithCookies() throws Exception {
		String email = "web+" + UUID.randomUUID() + "@example.com";

		MvcResult registerResult = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();

		String accessTokenValue = extractCookieValue(registerResult, "papervest_access");
		String refreshTokenValue = extractCookieValue(registerResult, "papervest_refresh");
		assertThat(accessTokenValue).isNotBlank();
		assertThat(refreshTokenValue).isNotBlank();
		assertThat(registerResult.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
				.anyMatch(header -> header.contains("papervest_access=") && header.contains("HttpOnly") && header.contains("SameSite=Lax"));
		assertThat(registerResult.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
				.anyMatch(header -> header.contains("papervest_refresh=") && header.contains("Path=/api/auth"));

		mockMvc.perform(get("/api/auth/session")
						.cookie(new Cookie("papervest_access", accessTokenValue)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").value(email));

		MvcResult refreshResult = mockMvc.perform(post("/api/auth/refresh")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "deviceName": "PaperVest Web"
								}
								""")
						.cookie(new Cookie("papervest_refresh", refreshTokenValue)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").value(email))
				.andReturn();

		String rotatedAccessTokenValue = extractCookieValue(refreshResult, "papervest_access");
		String rotatedRefreshTokenValue = extractCookieValue(refreshResult, "papervest_refresh");
		assertThat(rotatedAccessTokenValue).isNotBlank();
		assertThat(rotatedRefreshTokenValue).isNotBlank().isNotEqualTo(refreshTokenValue);

		mockMvc.perform(post("/api/auth/logout")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}")
						.cookie(new Cookie("papervest_refresh", rotatedRefreshTokenValue)))
				.andExpect(status().isNoContent())
				.andExpect(result -> {
					List<String> cookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
					assertThat(cookies)
							.anyMatch(header -> header.contains("papervest_access=") && header.contains("Max-Age=0"));
					assertThat(cookies)
							.anyMatch(header -> header.contains("papervest_refresh=") && header.contains("Max-Age=0"));
				});
	}

	@Test
	void browserOriginRegisterIsRejectedWithoutCsrfToken() throws Exception {
		mockMvc.perform(post("/api/auth/register")
						.header(HttpHeaders.ORIGIN, WEB_ORIGIN)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "blocked-%s@example.com",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(UUID.randomUUID())))
				.andExpect(status().isForbidden());
	}

	@Test
	void browserOriginCanBootstrapCsrfAndRegister() throws Exception {
		MvcResult csrfResult = mockMvc.perform(get("/api/auth/csrf")
						.header(HttpHeaders.ORIGIN, WEB_ORIGIN))
				.andExpect(status().isNoContent())
				.andReturn();

		String csrfTokenValue = extractCookieValue(csrfResult, "XSRF-TOKEN");

		mockMvc.perform(post("/api/auth/register")
						.header(HttpHeaders.ORIGIN, WEB_ORIGIN)
						.header("X-XSRF-TOKEN", csrfTokenValue)
						.cookie(new Cookie("XSRF-TOKEN", csrfTokenValue))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "browser-%s@example.com",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(UUID.randomUUID())))
				.andExpect(status().isCreated())
				.andExpect(result -> assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
						.anyMatch(header -> header.startsWith("papervest_access=")));
	}

	@Test
	void browserOriginCanBootstrapCsrfAndLogin() throws Exception {
		String email = "login-" + UUID.randomUUID() + "@example.com";

		mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(email)))
				.andExpect(status().isCreated());

		MvcResult csrfResult = mockMvc.perform(get("/api/auth/csrf")
						.header(HttpHeaders.ORIGIN, WEB_ORIGIN))
				.andExpect(status().isNoContent())
				.andReturn();

		String csrfTokenValue = extractCookieValue(csrfResult, "XSRF-TOKEN");

		mockMvc.perform(post("/api/auth/login")
						.header(HttpHeaders.ORIGIN, WEB_ORIGIN)
						.header("X-XSRF-TOKEN", csrfTokenValue)
						.cookie(new Cookie("XSRF-TOKEN", csrfTokenValue))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								""".formatted(email)))
				.andExpect(status().isOk())
				.andExpect(result -> assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
						.anyMatch(header -> header.startsWith("papervest_access=")))
				.andExpect(result -> assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
						.anyMatch(header -> header.startsWith("papervest_refresh=")));
	}

	private String extractCookieValue(MvcResult result, String cookieName) {
		return result.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
				.filter(header -> header.startsWith(cookieName + "="))
				.findFirst()
				.map(header -> header.substring((cookieName + "=").length(), header.indexOf(';')))
				.orElseThrow(() -> new AssertionError("Expected cookie " + cookieName + " to be set"));
	}
}

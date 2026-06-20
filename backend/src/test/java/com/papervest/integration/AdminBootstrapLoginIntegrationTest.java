package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.web.RequestIdFilter;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.user.model.User;
import com.papervest.user.model.UserRole;
import com.papervest.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.admin.bootstrap-emails=legacy-admin@example.com")
@ActiveProfiles("test")
class AdminBootstrapLoginIntegrationTest {

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
	private PasswordEncoder passwordEncoder;

	@MockitoBean
	private MarketDataService marketDataService;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
	}

	@Test
	void bootstrapEmailExistingAsUserIsPromotedOnLoginAndCanUseAdminApis() throws Exception {
		userRepository.save(new User(
				"legacy-admin@example.com",
				passwordEncoder.encode("SecurePass1"),
				UserRole.USER
		));

		MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "legacy-admin@example.com",
								  "password": "SecurePass1",
								  "deviceName": "PaperVest Web"
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").value("legacy-admin@example.com"))
				.andExpect(jsonPath("$.user.role").value("ADMIN"))
				.andReturn();

		JsonNode body = objectMapper.readTree(loginResult.getResponse().getContentAsString());
		String accessToken = body.path("accessToken").asText();
		assertThat(accessToken).isNotBlank();

		mockMvc.perform(get("/api/admin/support/users")
						.header("Authorization", "Bearer " + accessToken))
				.andExpect(status().isOk());

		User promotedUser = userRepository.findByEmail("legacy-admin@example.com").orElseThrow();
		assertThat(promotedUser.getRole()).isEqualTo(UserRole.ADMIN);
	}
}

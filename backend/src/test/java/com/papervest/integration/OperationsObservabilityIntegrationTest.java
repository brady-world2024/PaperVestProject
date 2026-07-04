package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
		"management.endpoint.health.show-details=always",
		"management.endpoint.health.show-components=always"
})
@ActiveProfiles("test")
class OperationsObservabilityIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	@Autowired
	private ObjectMapper objectMapper;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
	}

	@Test
	void healthProbesExposeLivenessAndReadiness() throws Exception {
		mockMvc.perform(get("/actuator/health"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("UP"));

		mockMvc.perform(get("/actuator/health/liveness"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("UP"));

		mockMvc.perform(get("/actuator/health/readiness"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("UP"))
				.andExpect(jsonPath("$.components.marketDataConfiguration.status").value("UP"))
				.andExpect(jsonPath("$.components.marketDataConfiguration.details.provider").value("FINNHUB"))
				.andExpect(jsonPath("$.components.conditionalOrdersRuntime.status").value("UP"))
				.andExpect(jsonPath("$.components.conditionalOrdersRuntime.details.listenerEnabled").value(false))
				.andExpect(jsonPath("$.components.conditionalOrdersRuntime.details.schedulerEnabled").value(false))
				.andExpect(jsonPath("$.components.ledgerReconciliation.status").value("UP"))
				.andExpect(jsonPath("$.components.ledgerReconciliation.details.issueCount").value(0));

		mockMvc.perform(get("/livez"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("UP"));

		mockMvc.perform(get("/readyz"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("UP"));
	}

	@Test
	void infoAndMetricsRequireAuthButReturnOperationsDetailsWhenAuthenticated() throws Exception {
		mockMvc.perform(get("/actuator/info"))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(get("/actuator/metrics"))
				.andExpect(status().isUnauthorized());

		String accessToken = registerAndExtractAccessToken();

		mockMvc.perform(get("/actuator/info")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.application.name").value("PaperVest API"))
				.andExpect(jsonPath("$.security.authRateLimitEnabled").value(false))
				.andExpect(jsonPath("$.marketData.provider").value("FINNHUB"))
				.andExpect(jsonPath("$.conditionalOrders.listenerEnabled").value(false));

		mockMvc.perform(get("/actuator/metrics")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.names", hasItem("jvm.memory.used")));
	}

	private String registerAndExtractAccessToken() throws Exception {
		String email = "ops-" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
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

		JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
		return body.path("accessToken").asText();
	}
}

package com.papervest.integration;

import com.papervest.common.web.RequestIdFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class RequestCorrelationIntegrationTest {

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
	void requestIdIsGeneratedWhenMissing() throws Exception {
		MvcResult result = mockMvc.perform(get("/api/auth/csrf"))
				.andExpect(status().isNoContent())
				.andExpect(header().exists("X-Request-Id"))
				.andExpect(header().exists("X-Correlation-Id"))
				.andReturn();

		String requestId = result.getResponse().getHeader("X-Request-Id");
		assertThat(requestId).isNotBlank();
		assertThat(result.getResponse().getHeader("X-Correlation-Id")).isEqualTo(requestId);
	}

	@Test
	void incomingRequestIdIsPreserved() throws Exception {
		mockMvc.perform(get("/api/auth/csrf")
						.header("X-Request-Id", "paper-req-123"))
				.andExpect(status().isNoContent())
				.andExpect(header().string("X-Request-Id", "paper-req-123"))
				.andExpect(header().string("X-Correlation-Id", "paper-req-123"));
	}

	@Test
	void authenticationFailuresReuseTheSameRequestId() throws Exception {
		mockMvc.perform(get("/api/portfolio")
						.header(HttpHeaders.ORIGIN, "http://localhost:3000")
						.header("X-Request-Id", "portfolio-req-456"))
				.andExpect(status().isUnauthorized())
				.andExpect(header().string("X-Request-Id", "portfolio-req-456"))
				.andExpect(header().string("X-Correlation-Id", "portfolio-req-456"))
				.andExpect(jsonPath("$.requestId").value("portfolio-req-456"));
	}
}

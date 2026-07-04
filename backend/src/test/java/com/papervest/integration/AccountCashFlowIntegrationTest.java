package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.web.RequestIdFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class AccountCashFlowIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
	}

	@Test
	void authenticatedCashFlowDepositListWithdrawalIdempotentRetryAndInsufficientCash() throws Exception {
		AuthContext auth = registerAndExtractAuthContext();

		MvcResult depositResult = mockMvc.perform(post("/api/account/cash-flows/deposits")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", " deposit-api-1 ")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "amount": 250.25,
								  "memo": "  Initial funding  "
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.type").value("DEPOSIT"))
				.andExpect(jsonPath("$.amount").value(250.25))
				.andExpect(jsonPath("$.cashBalanceAfter").value(100250.25))
				.andExpect(jsonPath("$.memo").value("Initial funding"))
				.andExpect(jsonPath("$.idempotentReplay").value(false))
				.andReturn();

		String depositId = objectMapper.readTree(depositResult.getResponse().getContentAsString()).path("id").asText();

		mockMvc.perform(post("/api/account/cash-flows/deposits")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "deposit-api-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "amount": 250.25,
								  "memo": "Initial funding"
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(depositId))
				.andExpect(jsonPath("$.cashBalanceAfter").value(100250.25))
				.andExpect(jsonPath("$.idempotentReplay").value(true));

		assertThat(singleMoney("select cash_balance from user_accounts where user_id = ?", auth.userId()))
				.isEqualByComparingTo("100250.25");
		assertThat(singleInt(
				"select count(*) from cash_ledger_entries where idempotency_key = ?",
				"cash-flow:%s:deposit-api-1".formatted(auth.userId())
		)).isEqualTo(1);

		AuthContext otherUser = registerAndExtractAuthContext();
		mockMvc.perform(post("/api/account/cash-flows/deposits")
						.header("Authorization", "Bearer " + otherUser.accessToken())
						.header("X-Idempotency-Key", "other-deposit")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "amount": 15.00,
								  "memo": "Other account"
								}
								"""))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/account/cash-flows/withdrawals")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "withdraw-api-1")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "amount": 100.25,
								  "memo": "Bank transfer"
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.type").value("WITHDRAWAL"))
				.andExpect(jsonPath("$.amount").value(-100.25))
				.andExpect(jsonPath("$.cashBalanceAfter").value(100150.00))
				.andExpect(jsonPath("$.memo").value("Bank transfer"))
				.andExpect(jsonPath("$.idempotentReplay").value(false));

		mockMvc.perform(get("/api/account/cash-flows")
						.header("Authorization", "Bearer " + auth.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cashFlows.length()").value(2))
				.andExpect(jsonPath("$.cashFlows[0].type").value("WITHDRAWAL"))
				.andExpect(jsonPath("$.cashFlows[0].amount").value(-100.25))
				.andExpect(jsonPath("$.cashFlows[1].type").value("DEPOSIT"))
				.andExpect(jsonPath("$.cashFlows[1].amount").value(250.25));

		mockMvc.perform(post("/api/account/cash-flows/withdrawals")
						.header("Authorization", "Bearer " + auth.accessToken())
						.header("X-Idempotency-Key", "too-much")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "amount": 1000000.00
								}
								"""))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.code").value("INSUFFICIENT_CASH"));

		assertThat(singleMoney("select cash_balance from user_accounts where user_id = ?", auth.userId()))
				.isEqualByComparingTo("100150.00");
	}

	private AuthContext registerAndExtractAuthContext() throws Exception {
		String email = "cash-flow+" + UUID.randomUUID() + "@example.com";
		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Cash Flow Test"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();

		JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
		return new AuthContext(
				jsonNode.path("accessToken").asText(),
				UUID.fromString(jsonNode.path("user").path("id").asText())
		);
	}

	private BigDecimal singleMoney(String sql, Object... args) {
		return jdbcTemplate.queryForObject(sql, BigDecimal.class, args);
	}

	private Integer singleInt(String sql, Object... args) {
		return jdbcTemplate.queryForObject(sql, Integer.class, args);
	}

	private record AuthContext(String accessToken, UUID userId) {
	}
}

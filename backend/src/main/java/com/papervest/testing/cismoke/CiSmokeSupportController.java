package com.papervest.testing.cismoke;

import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.Locale;

@RestController
@Profile("ci-smoke")
@RequestMapping("/api/test-support")
public class CiSmokeSupportController {

	private final CiSmokeState ciSmokeState;
	private final MarketDataService marketDataService;
	private final UserRepository userRepository;
	private final JdbcTemplate jdbcTemplate;

	public CiSmokeSupportController(
			CiSmokeState ciSmokeState,
			MarketDataService marketDataService,
			UserRepository userRepository,
			JdbcTemplate jdbcTemplate
	) {
		this.ciSmokeState = ciSmokeState;
		this.marketDataService = marketDataService;
		this.userRepository = userRepository;
		this.jdbcTemplate = jdbcTemplate;
	}

	@PostMapping("/market-session")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void setMarketSession(@RequestBody MarketSessionRequest request) {
		ciSmokeState.setMarketSession(request.session());
		marketDataService.clearRuntimeCaches();
	}

	@PostMapping("/cash-balance")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Transactional
	public void setCashBalance(@RequestBody CashBalanceRequest request) {
		User user = userRepository.findByEmail(normalizeEmail(request.email()))
				.orElseThrow(() -> new IllegalArgumentException("Smoke user not found"));

		jdbcTemplate.update(
				"""
				update user_accounts
				set cash_balance = ?, updated_at = ?, version = version + 1
				where user_id = ?
				""",
				request.cashBalance(),
				Timestamp.from(Instant.now()),
				user.getId()
		);
	}

	private String normalizeEmail(String email) {
		return email == null ? "" : email.trim().toLowerCase(Locale.US);
	}

	public record MarketSessionRequest(MarketSessionState session) {
	}

	public record CashBalanceRequest(String email, BigDecimal cashBalance) {
	}
}

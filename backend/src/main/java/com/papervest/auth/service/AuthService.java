package com.papervest.auth.service;

import com.papervest.auth.dto.AuthResponse;
import com.papervest.auth.dto.AuthUserResponse;
import com.papervest.auth.dto.LoginRequest;
import com.papervest.auth.dto.RegisterRequest;
import com.papervest.common.config.PortfolioProperties;
import com.papervest.common.exception.AuthenticationException;
import com.papervest.common.exception.ConflictException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.security.JwtService;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

	private static final Logger log = LoggerFactory.getLogger(AuthService.class);
	private final UserRepository userRepository;
	private final UserAccountRepository userAccountRepository;
	private final PasswordEncoder passwordEncoder;
	private final RefreshTokenService refreshTokenService;
	private final JwtService jwtService;
	private final PortfolioProperties portfolioProperties;

	public AuthService(
			UserRepository userRepository,
			UserAccountRepository userAccountRepository,
			PasswordEncoder passwordEncoder,
			RefreshTokenService refreshTokenService,
			JwtService jwtService,
			PortfolioProperties portfolioProperties
	) {
		this.userRepository = userRepository;
		this.userAccountRepository = userAccountRepository;
		this.passwordEncoder = passwordEncoder;
		this.refreshTokenService = refreshTokenService;
		this.jwtService = jwtService;
		this.portfolioProperties = portfolioProperties;
	}

	@Transactional
	public AuthResponse register(RegisterRequest request) {
		String normalizedEmail = normalizeEmail(request.email());

		if (userRepository.existsByEmail(normalizedEmail)) {
			log.warn("Registration rejected email={} reason=email_already_registered", maskEmail(normalizedEmail));
			throw new ConflictException("EMAIL_ALREADY_REGISTERED", "An account already exists for that email address");
		}

		User user = userRepository.save(new User(normalizedEmail, passwordEncoder.encode(request.password())));
		userAccountRepository.save(new UserAccount(user.getId(), portfolioProperties.initialCash()));
		log.info(
				"User registered userId={} email={} initialCash={} deviceName={}",
				user.getId(),
				maskEmail(user.getEmail()),
				portfolioProperties.initialCash(),
				normalizeDeviceName(request.deviceName())
		);

		return issueSession(user, request.deviceName());
	}

	@Transactional
	public AuthResponse login(LoginRequest request) {
		String normalizedEmail = normalizeEmail(request.email());
		User user = userRepository.findByEmail(normalizedEmail)
				.orElseThrow(() -> {
					log.warn("Login rejected email={} reason=credentials_rejected", maskEmail(normalizedEmail));
					return new AuthenticationException("Email or password is incorrect");
				});

		if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			log.warn("Login rejected email={} reason=credentials_rejected", maskEmail(normalizedEmail));
			throw new AuthenticationException("Email or password is incorrect");
		}

		log.info(
				"Login succeeded userId={} email={} deviceName={}",
				user.getId(),
				maskEmail(user.getEmail()),
				normalizeDeviceName(request.deviceName())
		);
		return issueSession(user, request.deviceName());
	}

	@Transactional
	public AuthResponse refresh(String refreshToken, String deviceName) {
		if (refreshToken == null || refreshToken.isBlank()) {
			log.warn("Refresh rejected reason=missing_refresh_token deviceName={}", normalizeDeviceName(deviceName));
			throw new AuthenticationException("Refresh token is invalid or expired");
		}

		RefreshTokenService.IssuedRefreshToken issuedRefreshToken = refreshTokenService.rotate(refreshToken, deviceName);
		User user = userRepository.findById(issuedRefreshToken.userId())
				.orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND", "User account could not be found"));
		log.info(
				"Session refreshed userId={} email={} deviceName={}",
				user.getId(),
				maskEmail(user.getEmail()),
				normalizeDeviceName(deviceName)
		);
		return buildAuthResponse(user, issuedRefreshToken);
	}

	@Transactional
	public void logout(String refreshToken) {
		if (refreshToken == null || refreshToken.isBlank()) {
			log.info("Logout requested without refresh token");
		}
		refreshTokenService.revoke(refreshToken);
	}

	private AuthResponse issueSession(User user, String deviceName) {
		RefreshTokenService.IssuedRefreshToken refreshToken = refreshTokenService.issue(user.getId(), deviceName);
		return buildAuthResponse(user, refreshToken);
	}

	private AuthResponse buildAuthResponse(User user, RefreshTokenService.IssuedRefreshToken issuedRefreshToken) {
		JwtService.AccessToken accessToken = jwtService.createAccessToken(user.getId(), user.getEmail());
		return new AuthResponse(
				accessToken.tokenValue(),
				issuedRefreshToken.rawToken(),
				accessToken.expiresAt(),
				new AuthUserResponse(user.getId(), user.getEmail())
		);
	}

	private String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.US);
	}

	private String normalizeDeviceName(String deviceName) {
		if (deviceName == null || deviceName.isBlank()) {
			return "unspecified";
		}
		String trimmed = deviceName.trim();
		return trimmed.length() > 80 ? trimmed.substring(0, 80) : trimmed;
	}

	private String maskEmail(String email) {
		if (email == null || email.isBlank()) {
			return "unknown";
		}
		int atIndex = email.indexOf('@');
		if (atIndex <= 1) {
			return "***";
		}
		return email.charAt(0) + "***" + email.substring(atIndex);
	}
}

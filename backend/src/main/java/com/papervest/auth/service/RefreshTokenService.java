package com.papervest.auth.service;

import com.papervest.auth.model.RefreshToken;
import com.papervest.auth.repository.RefreshTokenRepository;
import com.papervest.common.config.AppSecurityProperties;
import com.papervest.common.exception.AuthenticationException;
import com.papervest.common.util.TokenHashingUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
public class RefreshTokenService {

	private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
	private final RefreshTokenRepository refreshTokenRepository;
	private final AppSecurityProperties properties;
	private final Clock clock;
	private final SecureRandom secureRandom = new SecureRandom();

	public RefreshTokenService(
			RefreshTokenRepository refreshTokenRepository,
			AppSecurityProperties properties,
			Clock clock
	) {
		this.refreshTokenRepository = refreshTokenRepository;
		this.properties = properties;
		this.clock = clock;
	}

	@Transactional
	public IssuedRefreshToken issue(UUID userId, String deviceName) {
		String rawToken = generateRawToken();
		Instant expiresAt = clock.instant().plus(properties.refreshTokenTtl());
		String resolvedDeviceName = resolveDeviceName(deviceName, "mobile-app");
		RefreshToken refreshToken = new RefreshToken(
				userId,
				TokenHashingUtils.sha256(rawToken),
				resolvedDeviceName,
				expiresAt
		);
		refreshTokenRepository.save(refreshToken);
		return new IssuedRefreshToken(userId, rawToken, expiresAt);
	}

	@Transactional
	public IssuedRefreshToken rotate(String rawToken, String deviceName) {
		RefreshToken currentToken = requireActiveToken(rawToken);
		Instant now = clock.instant();
		currentToken.markUsed(now);
		currentToken.revoke(now);
		String nextDeviceName = resolveDeviceName(deviceName, currentToken.getDeviceName());
		IssuedRefreshToken rotated = issue(currentToken.getUserId(), nextDeviceName);
		log.info(
				"Refresh token rotated userId={} previousDeviceName={} nextDeviceName={} expiresAt={}",
				currentToken.getUserId(),
				currentToken.getDeviceName(),
				nextDeviceName,
				rotated.expiresAt()
		);
		return rotated;
	}

	@Transactional
	public void revoke(String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			log.debug("Refresh token revoke skipped reason=missing_token");
			return;
		}

		refreshTokenRepository.findByTokenHash(TokenHashingUtils.sha256(rawToken.trim()))
				.ifPresentOrElse(token -> {
					token.revoke(clock.instant());
					log.info(
							"Refresh token revoked userId={} deviceName={} expiresAt={}",
							token.getUserId(),
							token.getDeviceName(),
							token.getExpiresAt()
					);
				}, () -> log.info("Refresh token revoke ignored reason=token_not_found"));
	}

	@Transactional
	public void revokeAllForUser(UUID userId) {
		Instant now = clock.instant();
		refreshTokenRepository.findAllByUserIdAndRevokedAtIsNull(userId)
				.forEach(token -> token.revoke(now));
		log.info("All refresh tokens revoked userId={}", userId);
	}

	@Transactional(readOnly = true)
	public UUID requireUserId(String rawToken) {
		return requireActiveToken(rawToken).getUserId();
	}

	@Transactional(readOnly = true)
	public RefreshToken requireActiveToken(String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			log.warn("Refresh token validation failed reason=missing_token");
			throw new AuthenticationException("Refresh token is invalid or expired");
		}

		RefreshToken token = refreshTokenRepository.findByTokenHash(TokenHashingUtils.sha256(rawToken.trim()))
				.orElseThrow(() -> {
					log.warn("Refresh token validation failed reason=token_not_found");
					return new AuthenticationException("Refresh token is invalid or expired");
				});

		Instant now = clock.instant();
		if (!token.isActiveAt(now)) {
			String reason = token.getRevokedAt() != null ? "revoked" : "expired";
			log.warn(
					"Refresh token validation failed userId={} deviceName={} reason={} expiresAt={}",
					token.getUserId(),
					token.getDeviceName(),
					reason,
					token.getExpiresAt()
			);
			throw new AuthenticationException("Refresh token is invalid or expired");
		}

		return token;
	}

	private String generateRawToken() {
		byte[] bytes = new byte[32];
		secureRandom.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private String resolveDeviceName(String deviceName, String fallback) {
		if (deviceName == null || deviceName.isBlank()) {
			return fallback;
		}
		String trimmed = deviceName.trim();
		return trimmed.length() > 80 ? trimmed.substring(0, 80) : trimmed;
	}

	public record IssuedRefreshToken(UUID userId, String rawToken, Instant expiresAt) {
	}
}

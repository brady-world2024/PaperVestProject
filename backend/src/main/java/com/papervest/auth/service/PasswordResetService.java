package com.papervest.auth.service;

import com.papervest.auth.model.PasswordResetToken;
import com.papervest.auth.repository.PasswordResetTokenRepository;
import com.papervest.common.config.AccountLifecycleProperties;
import com.papervest.common.exception.BadRequestException;
import com.papervest.common.util.TokenHashingUtils;
import com.papervest.notification.service.NotificationService;
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;

@Service
public class PasswordResetService {

	private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
	private final PasswordResetTokenRepository tokenRepository;
	private final UserRepository userRepository;
	private final AccountLifecycleProperties properties;
	private final OneTimeTokenFactory tokenFactory;
	private final AccountLifecycleMessageService messageService;
	private final PasswordEncoder passwordEncoder;
	private final RefreshTokenService refreshTokenService;
	private final NotificationService notificationService;
	private final Clock clock;

	public PasswordResetService(
			PasswordResetTokenRepository tokenRepository,
			UserRepository userRepository,
			AccountLifecycleProperties properties,
			OneTimeTokenFactory tokenFactory,
			AccountLifecycleMessageService messageService,
			PasswordEncoder passwordEncoder,
			RefreshTokenService refreshTokenService,
			NotificationService notificationService,
			Clock clock
	) {
		this.tokenRepository = tokenRepository;
		this.userRepository = userRepository;
		this.properties = properties;
		this.tokenFactory = tokenFactory;
		this.messageService = messageService;
		this.passwordEncoder = passwordEncoder;
		this.refreshTokenService = refreshTokenService;
		this.notificationService = notificationService;
		this.clock = clock;
	}

	@Transactional
	public void requestReset(String email) {
		if (email == null || email.isBlank()) {
			return;
		}

		String normalizedEmail = email.trim().toLowerCase(Locale.US);
		boolean issued = userRepository.findByEmail(normalizedEmail)
				.map(user -> {
					issueResetForUser(user);
					return true;
				})
				.orElse(false);
		log.info(
				"Password reset requested email={} issued={}",
				maskEmail(normalizedEmail),
				issued
		);
	}

	@Transactional
	public void resetPassword(String rawToken, String nextPassword) {
		PasswordResetToken token = requireActiveToken(rawToken);
		User user = userRepository.findById(token.getUserId())
				.orElseThrow(() -> new BadRequestException("INVALID_PASSWORD_RESET_TOKEN", "Password reset token is invalid or expired"));

		token.consume(clock.instant());
		user.changePasswordHash(passwordEncoder.encode(nextPassword));
		refreshTokenService.revokeAllForUser(user.getId());
		notificationService.notifyPasswordChanged(user);
		log.info(
				"Password reset completed userId={} email={}",
				user.getId(),
				maskEmail(user.getEmail())
		);
	}

	private void issueResetForUser(User user) {
		Instant now = clock.instant();
		tokenRepository.findAllByUserIdAndConsumedAtIsNull(user.getId())
				.forEach(token -> token.consume(now));

		String rawToken = tokenFactory.create();
		tokenRepository.save(new PasswordResetToken(
				user.getId(),
				TokenHashingUtils.sha256(rawToken),
				now.plus(properties.passwordResetTokenTtl())
		));
		messageService.sendPasswordReset(user, rawToken);
	}

	@Transactional(readOnly = true)
	public PasswordResetToken requireActiveToken(String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			throw new BadRequestException("INVALID_PASSWORD_RESET_TOKEN", "Password reset token is invalid or expired");
		}

		PasswordResetToken token = tokenRepository.findByTokenHash(TokenHashingUtils.sha256(rawToken.trim()))
				.orElseThrow(() -> new BadRequestException(
						"INVALID_PASSWORD_RESET_TOKEN",
						"Password reset token is invalid or expired"
				));

		if (!token.isActiveAt(clock.instant())) {
			throw new BadRequestException("INVALID_PASSWORD_RESET_TOKEN", "Password reset token is invalid or expired");
		}

		return token;
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

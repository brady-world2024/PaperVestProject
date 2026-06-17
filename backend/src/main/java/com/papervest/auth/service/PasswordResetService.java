package com.papervest.auth.service;

import com.papervest.auth.model.PasswordResetToken;
import com.papervest.auth.repository.PasswordResetTokenRepository;
import com.papervest.common.config.AccountLifecycleProperties;
import com.papervest.common.exception.BadRequestException;
import com.papervest.common.util.TokenHashingUtils;
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

@Service
public class PasswordResetService {

	private final PasswordResetTokenRepository tokenRepository;
	private final UserRepository userRepository;
	private final AccountLifecycleProperties properties;
	private final OneTimeTokenFactory tokenFactory;
	private final AccountLifecycleMessageService messageService;
	private final PasswordEncoder passwordEncoder;
	private final RefreshTokenService refreshTokenService;
	private final Clock clock;

	public PasswordResetService(
			PasswordResetTokenRepository tokenRepository,
			UserRepository userRepository,
			AccountLifecycleProperties properties,
			OneTimeTokenFactory tokenFactory,
			AccountLifecycleMessageService messageService,
			PasswordEncoder passwordEncoder,
			RefreshTokenService refreshTokenService,
			Clock clock
	) {
		this.tokenRepository = tokenRepository;
		this.userRepository = userRepository;
		this.properties = properties;
		this.tokenFactory = tokenFactory;
		this.messageService = messageService;
		this.passwordEncoder = passwordEncoder;
		this.refreshTokenService = refreshTokenService;
		this.clock = clock;
	}

	@Transactional
	public void requestReset(String email) {
		if (email == null || email.isBlank()) {
			return;
		}

		userRepository.findByEmail(email.trim().toLowerCase())
				.ifPresent(this::issueResetForUser);
	}

	@Transactional
	public void resetPassword(String rawToken, String nextPassword) {
		PasswordResetToken token = requireActiveToken(rawToken);
		User user = userRepository.findById(token.getUserId())
				.orElseThrow(() -> new BadRequestException("INVALID_PASSWORD_RESET_TOKEN", "Password reset token is invalid or expired"));

		token.consume(clock.instant());
		user.changePasswordHash(passwordEncoder.encode(nextPassword));
		refreshTokenService.revokeAllForUser(user.getId());
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
}

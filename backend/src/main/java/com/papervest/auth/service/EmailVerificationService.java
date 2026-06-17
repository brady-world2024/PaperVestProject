package com.papervest.auth.service;

import com.papervest.auth.model.EmailVerificationToken;
import com.papervest.auth.repository.EmailVerificationTokenRepository;
import com.papervest.common.config.AccountLifecycleProperties;
import com.papervest.common.exception.BadRequestException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.TokenHashingUtils;
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
public class EmailVerificationService {

	private final EmailVerificationTokenRepository tokenRepository;
	private final UserRepository userRepository;
	private final AccountLifecycleProperties properties;
	private final OneTimeTokenFactory tokenFactory;
	private final AccountLifecycleMessageService messageService;
	private final Clock clock;

	public EmailVerificationService(
			EmailVerificationTokenRepository tokenRepository,
			UserRepository userRepository,
			AccountLifecycleProperties properties,
			OneTimeTokenFactory tokenFactory,
			AccountLifecycleMessageService messageService,
			Clock clock
	) {
		this.tokenRepository = tokenRepository;
		this.userRepository = userRepository;
		this.properties = properties;
		this.tokenFactory = tokenFactory;
		this.messageService = messageService;
		this.clock = clock;
	}

	@Transactional
	public void issueForUser(User user) {
		if (user.isEmailVerified()) {
			return;
		}

		Instant now = clock.instant();
		tokenRepository.findAllByUserIdAndConsumedAtIsNull(user.getId())
				.forEach(token -> token.consume(now));

		String rawToken = tokenFactory.create();
		tokenRepository.save(new EmailVerificationToken(
				user.getId(),
				TokenHashingUtils.sha256(rawToken),
				now.plus(properties.emailVerificationTokenTtl())
		));
		messageService.sendEmailVerification(user, rawToken);
	}

	@Transactional
	public User confirm(String rawToken) {
		EmailVerificationToken token = requireActiveToken(rawToken);
		User user = userRepository.findById(token.getUserId())
				.orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND", "User account could not be found"));

		token.consume(clock.instant());
		user.markEmailVerified(clock.instant());
		return user;
	}

	@Transactional(readOnly = true)
	public EmailVerificationToken requireActiveToken(String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			throw new BadRequestException("INVALID_EMAIL_VERIFICATION_TOKEN", "Email verification token is invalid or expired");
		}

		EmailVerificationToken token = tokenRepository.findByTokenHash(TokenHashingUtils.sha256(rawToken.trim()))
				.orElseThrow(() -> new BadRequestException(
						"INVALID_EMAIL_VERIFICATION_TOKEN",
						"Email verification token is invalid or expired"
				));

		if (!token.isActiveAt(clock.instant())) {
			throw new BadRequestException("INVALID_EMAIL_VERIFICATION_TOKEN", "Email verification token is invalid or expired");
		}

		return token;
	}

	@Transactional
	public void issueForUserId(UUID userId) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND", "User account could not be found"));
		issueForUser(user);
	}
}

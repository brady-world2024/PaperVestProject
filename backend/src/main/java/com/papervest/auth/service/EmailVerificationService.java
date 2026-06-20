package com.papervest.auth.service;

import com.papervest.auth.model.EmailVerificationToken;
import com.papervest.auth.repository.EmailVerificationTokenRepository;
import com.papervest.common.config.AccountLifecycleProperties;
import com.papervest.common.exception.BadRequestException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.TokenHashingUtils;
import com.papervest.notification.service.NotificationService;
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
public class EmailVerificationService {

	private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
	private final EmailVerificationTokenRepository tokenRepository;
	private final UserRepository userRepository;
	private final AccountLifecycleProperties properties;
	private final OneTimeTokenFactory tokenFactory;
	private final AccountLifecycleMessageService messageService;
	private final NotificationService notificationService;
	private final Clock clock;

	public EmailVerificationService(
			EmailVerificationTokenRepository tokenRepository,
			UserRepository userRepository,
			AccountLifecycleProperties properties,
			OneTimeTokenFactory tokenFactory,
			AccountLifecycleMessageService messageService,
			NotificationService notificationService,
			Clock clock
	) {
		this.tokenRepository = tokenRepository;
		this.userRepository = userRepository;
		this.properties = properties;
		this.tokenFactory = tokenFactory;
		this.messageService = messageService;
		this.notificationService = notificationService;
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
		notificationService.notifyEmailVerified(user);
		log.info(
				"Email verification confirmed userId={} email={}",
				user.getId(),
				maskEmail(user.getEmail())
		);
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

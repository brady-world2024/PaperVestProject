package com.papervest.account.service;

import com.papervest.account.dto.AccountProfileResponse;
import com.papervest.account.dto.ChangePasswordRequest;
import com.papervest.auth.dto.AuthResponse;
import com.papervest.auth.service.AuthService;
import com.papervest.auth.service.EmailVerificationService;
import com.papervest.auth.service.RefreshTokenService;
import com.papervest.common.exception.AuthenticationException;
import com.papervest.common.exception.BadRequestException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.notification.service.NotificationService;
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AccountService {

	private static final Logger log = LoggerFactory.getLogger(AccountService.class);
	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final RefreshTokenService refreshTokenService;
	private final AuthService authService;
	private final EmailVerificationService emailVerificationService;
	private final NotificationService notificationService;

	public AccountService(
			UserRepository userRepository,
			PasswordEncoder passwordEncoder,
			RefreshTokenService refreshTokenService,
			AuthService authService,
			EmailVerificationService emailVerificationService,
			NotificationService notificationService
	) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.refreshTokenService = refreshTokenService;
		this.authService = authService;
		this.emailVerificationService = emailVerificationService;
		this.notificationService = notificationService;
	}

	@Transactional(readOnly = true)
	public AccountProfileResponse getProfile(UUID userId) {
		User user = requireUser(userId);
		return new AccountProfileResponse(
				user.getId(),
				user.getEmail(),
				user.getRole(),
				user.isEmailVerified(),
				user.getEmailVerifiedAt(),
				user.getCreatedAt()
		);
	}

	@Transactional
	public AuthResponse changePassword(UUID userId, ChangePasswordRequest request) {
		if (!request.newPassword().equals(request.confirmNewPassword())) {
			throw new BadRequestException("PASSWORD_CONFIRMATION_MISMATCH", "Password confirmation does not match");
		}

		User user = requireUser(userId);
		if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
			throw new AuthenticationException("Current password is incorrect");
		}

		user.changePasswordHash(passwordEncoder.encode(request.newPassword()));
		refreshTokenService.revokeAllForUser(userId);
		log.info(
				"Password changed userId={} email={} deviceName={}",
				user.getId(),
				maskEmail(user.getEmail()),
				normalizeDeviceName(request.deviceName())
		);
		notificationService.notifyPasswordChanged(user);
		return authService.issueFreshSession(user, request.deviceName());
	}

	@Transactional
	public void requestEmailVerification(UUID userId) {
		emailVerificationService.issueForUserId(userId);
	}

	@Transactional
	public void deleteAccount(UUID userId, String currentPassword) {
		User user = requireUser(userId);
		if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
			throw new AuthenticationException("Current password is incorrect");
		}
		log.warn(
				"Account deleted userId={} email={}",
				user.getId(),
				maskEmail(user.getEmail())
		);
		userRepository.delete(user);
	}

	private User requireUser(UUID userId) {
		return userRepository.findById(userId)
				.orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND", "User account could not be found"));
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

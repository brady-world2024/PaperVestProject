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
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AccountService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final RefreshTokenService refreshTokenService;
	private final AuthService authService;
	private final EmailVerificationService emailVerificationService;

	public AccountService(
			UserRepository userRepository,
			PasswordEncoder passwordEncoder,
			RefreshTokenService refreshTokenService,
			AuthService authService,
			EmailVerificationService emailVerificationService
	) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.refreshTokenService = refreshTokenService;
		this.authService = authService;
		this.emailVerificationService = emailVerificationService;
	}

	@Transactional(readOnly = true)
	public AccountProfileResponse getProfile(UUID userId) {
		User user = requireUser(userId);
		return new AccountProfileResponse(
				user.getId(),
				user.getEmail(),
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
		userRepository.delete(user);
	}

	private User requireUser(UUID userId) {
		return userRepository.findById(userId)
				.orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND", "User account could not be found"));
	}
}

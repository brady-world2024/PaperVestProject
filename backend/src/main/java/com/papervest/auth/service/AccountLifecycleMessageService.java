package com.papervest.auth.service;

import com.papervest.common.config.AccountLifecycleProperties;
import com.papervest.user.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AccountLifecycleMessageService {

	private static final Logger log = LoggerFactory.getLogger(AccountLifecycleMessageService.class);
	private final AccountLifecycleProperties properties;

	public AccountLifecycleMessageService(AccountLifecycleProperties properties) {
		this.properties = properties;
	}

	public void sendEmailVerification(User user, String rawToken) {
		log.info(
				"Email verification link issued userId={} email={} link={}",
				user.getId(),
				maskEmail(user.getEmail()),
				buildLink("/verify-email?token=" + rawToken)
		);
	}

	public void sendPasswordReset(User user, String rawToken) {
		log.info(
				"Password reset link issued userId={} email={} link={}",
				user.getId(),
				maskEmail(user.getEmail()),
				buildLink("/reset-password?token=" + rawToken)
		);
	}

	private String buildLink(String path) {
		String base = properties.webBaseUrl();
		if (base.endsWith("/")) {
			return base.substring(0, base.length() - 1) + path;
		}
		return base + path;
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

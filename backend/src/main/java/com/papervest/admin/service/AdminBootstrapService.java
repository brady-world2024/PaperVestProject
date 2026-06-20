package com.papervest.admin.service;

import com.papervest.admin.config.AdminProperties;
import com.papervest.user.model.User;
import com.papervest.user.model.UserRole;
import com.papervest.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminBootstrapService {

	private static final Logger log = LoggerFactory.getLogger(AdminBootstrapService.class);

	private final AdminProperties adminProperties;
	private final UserRepository userRepository;

	public AdminBootstrapService(AdminProperties adminProperties, UserRepository userRepository) {
		this.adminProperties = adminProperties;
		this.userRepository = userRepository;
	}

	public UserRole initialRoleForEmail(String normalizedEmail) {
		return adminProperties.isBootstrapAdminEmail(normalizedEmail) ? UserRole.ADMIN : UserRole.USER;
	}

	@EventListener(ApplicationReadyEvent.class)
	@Transactional
	public void reconcileBootstrapAdmins() {
		var bootstrapEmails = adminProperties.normalizedBootstrapEmails();
		if (bootstrapEmails.isEmpty()) {
			return;
		}

		userRepository.findAllByEmailIn(bootstrapEmails).forEach(user -> promoteIfNeeded(user));
	}

	private void promoteIfNeeded(User user) {
		if (user.getRole() == UserRole.ADMIN) {
			return;
		}
		user.changeRole(UserRole.ADMIN);
		log.warn("Admin bootstrap applied userId={} email={}", user.getId(), maskEmail(user.getEmail()));
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

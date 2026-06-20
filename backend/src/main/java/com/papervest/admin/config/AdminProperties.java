package com.papervest.admin.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@ConfigurationProperties("app.admin")
public record AdminProperties(String bootstrapEmails) {

	public Set<String> normalizedBootstrapEmails() {
		if (bootstrapEmails == null || bootstrapEmails.isBlank()) {
			return Set.of();
		}
		return Arrays.stream(bootstrapEmails.split(","))
				.map(String::trim)
				.filter(value -> !value.isBlank())
				.map(value -> value.toLowerCase(Locale.US))
				.collect(Collectors.toUnmodifiableSet());
	}

	public boolean isBootstrapAdminEmail(String email) {
		if (email == null || email.isBlank()) {
			return false;
		}
		return normalizedBootstrapEmails().contains(email.trim().toLowerCase(Locale.US));
	}
}

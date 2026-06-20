package com.papervest.adminsupport.dto;

import java.time.Instant;

public record SupportSessionResponse(
		String sessionId,
		String deviceName,
		Instant createdAt,
		Instant lastUsedAt,
		Instant expiresAt
) {
}

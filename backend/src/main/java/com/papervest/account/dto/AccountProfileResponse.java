package com.papervest.account.dto;

import java.time.Instant;
import java.util.UUID;

public record AccountProfileResponse(
		UUID userId,
		String email,
		boolean emailVerified,
		Instant emailVerifiedAt,
		Instant createdAt
) {
}

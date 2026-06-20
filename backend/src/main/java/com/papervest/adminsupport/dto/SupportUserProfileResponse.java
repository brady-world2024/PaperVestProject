package com.papervest.adminsupport.dto;

import com.papervest.user.model.UserRole;

import java.time.Instant;

public record SupportUserProfileResponse(
		String userId,
		String email,
		UserRole role,
		boolean emailVerified,
		Instant emailVerifiedAt,
		Instant createdAt
) {
}

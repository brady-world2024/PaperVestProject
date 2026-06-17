package com.papervest.auth.dto;

import java.time.Instant;

public record EmailVerificationResultResponse(
		String email,
		Instant emailVerifiedAt
) {
}

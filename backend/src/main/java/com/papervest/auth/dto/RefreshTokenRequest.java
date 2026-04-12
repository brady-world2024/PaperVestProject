package com.papervest.auth.dto;

import jakarta.validation.constraints.Size;

public record RefreshTokenRequest(
		String refreshToken,
		@Size(max = 120) String deviceName
) {
}

package com.papervest.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record ConfirmEmailVerificationRequest(
		@NotBlank String token
) {
}

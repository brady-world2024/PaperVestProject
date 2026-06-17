package com.papervest.account.dto;

import jakarta.validation.constraints.NotBlank;

public record DeleteAccountRequest(
		@NotBlank String currentPassword
) {
}

package com.papervest.account.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
		@NotBlank String currentPassword,
		@NotBlank
		@Pattern(
				regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,72}$",
				message = "Password must contain upper, lower, and numeric characters"
		)
		String newPassword,
		@NotBlank String confirmNewPassword,
		@Size(max = 120) String deviceName
) {
}

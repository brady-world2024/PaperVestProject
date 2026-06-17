package com.papervest.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ResetPasswordRequest(
		@NotBlank String token,
		@NotBlank
		@Pattern(
				regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,72}$",
				message = "Password must contain upper, lower, and numeric characters"
		)
		String password,
		@NotBlank String confirmPassword
) {
}

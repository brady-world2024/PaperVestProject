package com.papervest.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LoginRequest(
		@NotBlank @Email String email,
		@NotBlank
		@Pattern(
				regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,72}$",
				message = "Password must contain upper, lower, and numeric characters"
		)
		String password,
		@Size(max = 120) String deviceName
) {
}

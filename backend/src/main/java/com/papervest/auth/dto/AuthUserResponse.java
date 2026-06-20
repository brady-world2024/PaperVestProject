package com.papervest.auth.dto;

import com.papervest.user.model.UserRole;

import java.util.UUID;

public record AuthUserResponse(UUID id, String email, UserRole role) {
}

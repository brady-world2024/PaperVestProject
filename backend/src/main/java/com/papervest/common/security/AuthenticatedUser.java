package com.papervest.common.security;

import com.papervest.user.model.UserRole;

import java.util.UUID;

public record AuthenticatedUser(UUID userId, String email, UserRole role) {
}

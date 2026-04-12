package com.papervest.auth.dto;

import java.util.UUID;

public record AuthUserResponse(UUID id, String email) {
}

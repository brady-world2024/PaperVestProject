package com.papervest.notification.dto;

import com.papervest.notification.model.NotificationType;

import java.time.Instant;

public record NotificationResponse(
		String id,
		NotificationType type,
		String title,
		String message,
		String actionPath,
		boolean read,
		Instant readAt,
		Instant createdAt
) {
}

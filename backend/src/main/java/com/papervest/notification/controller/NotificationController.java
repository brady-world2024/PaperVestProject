package com.papervest.notification.controller;

import com.papervest.common.security.AuthenticatedUser;
import com.papervest.notification.dto.NotificationListResponse;
import com.papervest.notification.dto.NotificationResponse;
import com.papervest.notification.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

	private final NotificationService notificationService;

	public NotificationController(NotificationService notificationService) {
		this.notificationService = notificationService;
	}

	@GetMapping
	public NotificationListResponse list(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return notificationService.list(currentUser.userId());
	}

	@PostMapping("/{id}/read")
	public NotificationResponse markRead(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@PathVariable UUID id
	) {
		return notificationService.markRead(currentUser.userId(), id);
	}

	@PostMapping("/read-all")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void markAllRead(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		notificationService.markAllRead(currentUser.userId());
	}
}

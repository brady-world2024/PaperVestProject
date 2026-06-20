package com.papervest.notification.service;

import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.conditionalorder.model.ConditionalOrder;
import com.papervest.conditionalorder.model.ConditionalOrderStatus;
import com.papervest.notification.dto.NotificationListResponse;
import com.papervest.notification.dto.NotificationResponse;
import com.papervest.notification.model.NotificationType;
import com.papervest.notification.model.UserNotification;
import com.papervest.notification.repository.UserNotificationRepository;
import com.papervest.user.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

	private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

	private final UserNotificationRepository notificationRepository;
	private final Clock clock;

	public NotificationService(UserNotificationRepository notificationRepository, Clock clock) {
		this.notificationRepository = notificationRepository;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public NotificationListResponse list(UUID userId) {
		return new NotificationListResponse(
				notificationRepository.countByUserIdAndReadAtIsNull(userId),
				notificationRepository.findTop50ByUserIdOrderByCreatedAtDesc(userId)
						.stream()
						.map(this::toResponse)
						.toList()
		);
	}

	@Transactional
	public NotificationResponse markRead(UUID userId, UUID notificationId) {
		UserNotification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
				.orElseThrow(() -> new ResourceNotFoundException("NOTIFICATION_NOT_FOUND", "Notification could not be found"));
		notification.markRead(clock.instant());
		return toResponse(notification);
	}

	@Transactional
	public void markAllRead(UUID userId) {
		Instant now = clock.instant();
		notificationRepository.findByUserIdAndReadAtIsNullOrderByCreatedAtDesc(userId)
				.forEach(notification -> notification.markRead(now));
	}

	@Transactional
	public void notifyConditionalOrderCreated(ConditionalOrder order) {
		create(
				order.getUserId(),
				NotificationType.CONDITIONAL_ORDER_CREATED,
				"Conditional order created",
				"%s %s order for %s shares at %s is now active.".formatted(
						order.getSide().name(),
						order.getSymbol(),
						formatQuantity(order.getQuantity()),
						formatMoney(order.getTargetPrice())
				),
				"/orders"
		);
	}

	@Transactional
	public void notifyConditionalOrderStatusChanged(
			ConditionalOrder order,
			ConditionalOrderStatus toStatus,
			String reasonMessage
	) {
		NotificationType type = switch (toStatus) {
			case TRIGGERED -> NotificationType.CONDITIONAL_ORDER_TRIGGERED;
			case FILLED -> NotificationType.CONDITIONAL_ORDER_FILLED;
			case FAILED -> NotificationType.CONDITIONAL_ORDER_FAILED;
			case CANCELLED -> NotificationType.CONDITIONAL_ORDER_CANCELLED;
			case EXPIRED -> NotificationType.CONDITIONAL_ORDER_EXPIRED;
			default -> null;
		};
		if (type == null) {
			return;
		}

		String title = switch (type) {
			case CONDITIONAL_ORDER_TRIGGERED -> "Conditional order triggered";
			case CONDITIONAL_ORDER_FILLED -> "Conditional order filled";
			case CONDITIONAL_ORDER_FAILED -> "Conditional order failed";
			case CONDITIONAL_ORDER_CANCELLED -> "Conditional order cancelled";
			case CONDITIONAL_ORDER_EXPIRED -> "Conditional order expired";
			default -> "Notification";
		};
		String message = switch (type) {
			case CONDITIONAL_ORDER_TRIGGERED -> "%s %s target price was reached and the order was queued for execution.".formatted(
					order.getSide().name(),
					order.getSymbol()
			);
			case CONDITIONAL_ORDER_FILLED -> "%s %s order executed successfully.".formatted(
					order.getSide().name(),
					order.getSymbol()
			);
			case CONDITIONAL_ORDER_FAILED -> "%s %s order failed: %s".formatted(
					order.getSide().name(),
					order.getSymbol(),
					reasonMessage
			);
			case CONDITIONAL_ORDER_CANCELLED -> "%s %s order was cancelled.".formatted(
					order.getSide().name(),
					order.getSymbol()
			);
			case CONDITIONAL_ORDER_EXPIRED -> "%s %s order expired before execution.".formatted(
					order.getSide().name(),
					order.getSymbol()
			);
			default -> reasonMessage;
		};

		create(order.getUserId(), type, title, message, "/orders");
	}

	@Transactional
	public void notifyEmailVerified(User user) {
		create(
				user.getId(),
				NotificationType.EMAIL_VERIFIED,
				"Email verified",
				"Your email address has been confirmed and your account is now treated as verified.",
				"/account"
		);
	}

	@Transactional
	public void notifyPasswordChanged(User user) {
		create(
				user.getId(),
				NotificationType.PASSWORD_CHANGED,
				"Password updated",
				"Your password was changed successfully and older refresh-token sessions were revoked.",
				"/account"
		);
	}

	private void create(UUID userId, NotificationType type, String title, String message, String actionPath) {
		notificationRepository.save(new UserNotification(userId, type, title, message, actionPath));
		log.info("Notification created userId={} type={} title={}", userId, type, title);
	}

	private NotificationResponse toResponse(UserNotification notification) {
		return new NotificationResponse(
				notification.getId().toString(),
				notification.getType(),
				notification.getTitle(),
				notification.getMessage(),
				notification.getActionPath(),
				notification.isRead(),
				notification.getReadAt(),
				notification.getCreatedAt()
		);
	}

	private String formatMoney(BigDecimal value) {
		return "$" + value.setScale(2).toPlainString();
	}

	private String formatQuantity(BigDecimal value) {
		return value.stripTrailingZeros().toPlainString();
	}
}

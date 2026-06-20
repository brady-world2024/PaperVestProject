package com.papervest.notification.repository;

import com.papervest.notification.model.UserNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserNotificationRepository extends JpaRepository<UserNotification, UUID> {

	List<UserNotification> findTop50ByUserIdOrderByCreatedAtDesc(UUID userId);

	List<UserNotification> findTop10ByUserIdOrderByCreatedAtDesc(UUID userId);

	Optional<UserNotification> findByIdAndUserId(UUID id, UUID userId);

	long countByUserIdAndReadAtIsNull(UUID userId);

	List<UserNotification> findByUserIdAndReadAtIsNullOrderByCreatedAtDesc(UUID userId);
}

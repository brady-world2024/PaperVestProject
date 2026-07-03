package com.papervest.orders.repository;

import com.papervest.orders.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

	Optional<Order> findByUserIdAndIdempotencyKey(UUID userId, String idempotencyKey);

	List<Order> findTop200ByUserIdOrderByCreatedAtDesc(UUID userId);

	Optional<Order> findByIdAndUserId(UUID id, UUID userId);
}

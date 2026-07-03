package com.papervest.orders.repository;

import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderStatus;
import com.papervest.orders.model.OrderType;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

	Optional<Order> findByUserIdAndIdempotencyKey(UUID userId, String idempotencyKey);

	List<Order> findTop200ByUserIdOrderByCreatedAtDesc(UUID userId);

	Optional<Order> findByIdAndUserId(UUID id, UUID userId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select o from Order o where o.id = :id and o.userId = :userId")
	Optional<Order> findByIdAndUserIdForUpdate(UUID id, UUID userId);

	@Query("select o from Order o where o.status = :status and o.orderType in :orderTypes order by o.createdAt asc")
	List<Order> findPendingExecutionCandidates(OrderStatus status, List<OrderType> orderTypes, Pageable pageable);

	@Query("select o from Order o where o.status = :status and o.expiresAt is not null and o.expiresAt <= :now order by o.expiresAt asc")
	List<Order> findDueForExpiration(OrderStatus status, Instant now, Pageable pageable);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select o from Order o where o.id = :id")
	Optional<Order> findByIdForUpdate(UUID id);
}

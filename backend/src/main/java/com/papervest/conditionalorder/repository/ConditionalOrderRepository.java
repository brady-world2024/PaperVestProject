package com.papervest.conditionalorder.repository;

import com.papervest.conditionalorder.model.ConditionalOrder;
import com.papervest.conditionalorder.model.ConditionalOrderFailureCode;
import com.papervest.conditionalorder.model.ConditionalOrderStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConditionalOrderRepository extends JpaRepository<ConditionalOrder, UUID> {

	List<ConditionalOrder> findByUserIdOrderByCreatedAtDesc(UUID userId);

	Optional<ConditionalOrder> findByIdAndUserId(UUID id, UUID userId);

	List<ConditionalOrder> findByStatusOrderByCreatedAtAsc(ConditionalOrderStatus status, Pageable pageable);

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("""
			update ConditionalOrder order
			set order.lastCheckedPrice = :lastCheckedPrice
			where order.id = :orderId and order.status = com.papervest.conditionalorder.model.ConditionalOrderStatus.ACTIVE
			""")
	int updateLastCheckedPrice(UUID orderId, BigDecimal lastCheckedPrice);

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("""
			update ConditionalOrder order
			set order.status = :toStatus,
			    order.failureCode = :failureCode,
			    order.failureMessage = :failureMessage,
			    order.lastCheckedPrice = :lastCheckedPrice,
			    order.triggeredAt = :triggeredAt,
			    order.executedAt = :executedAt,
			    order.updatedAt = :updatedAt,
			    order.version = order.version + 1
			where order.id = :orderId
			  and order.status = :fromStatus
			  and order.version = :version
			""")
	int advanceState(
			UUID orderId,
			ConditionalOrderStatus fromStatus,
			ConditionalOrderStatus toStatus,
			long version,
			ConditionalOrderFailureCode failureCode,
			String failureMessage,
			BigDecimal lastCheckedPrice,
			Instant triggeredAt,
			Instant executedAt,
			Instant updatedAt
	);
}

package com.papervest.orders.execution.repository;

import com.papervest.orders.execution.model.OrderExecutionRequest;
import com.papervest.orders.execution.model.OrderExecutionRequestStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderExecutionRequestRepository extends JpaRepository<OrderExecutionRequest, UUID> {

	boolean existsByOrderId(UUID orderId);

	Optional<OrderExecutionRequest> findByOrderId(UUID orderId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select request from OrderExecutionRequest request where request.id = :id")
	Optional<OrderExecutionRequest> findByIdForUpdate(UUID id);

	@Query("select request from OrderExecutionRequest request where request.status = :status order by request.createdAt asc")
	List<OrderExecutionRequest> findPendingForDispatch(OrderExecutionRequestStatus status, Pageable pageable);
}

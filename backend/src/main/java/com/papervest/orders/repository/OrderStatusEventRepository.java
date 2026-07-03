package com.papervest.orders.repository;

import com.papervest.orders.model.OrderStatusEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OrderStatusEventRepository extends JpaRepository<OrderStatusEvent, UUID> {

	List<OrderStatusEvent> findByOrderIdOrderByCreatedAtAsc(UUID orderId);
}

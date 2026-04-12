package com.papervest.conditionalorder.repository;

import com.papervest.conditionalorder.model.ConditionalOrderStatusEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ConditionalOrderStatusEventRepository extends JpaRepository<ConditionalOrderStatusEvent, UUID> {

	List<ConditionalOrderStatusEvent> findByConditionalOrderIdOrderByCreatedAtAsc(UUID conditionalOrderId);
}

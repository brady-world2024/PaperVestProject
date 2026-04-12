package com.papervest.conditionalorder.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.conditionalorder.model.ConditionalOrder;
import com.papervest.conditionalorder.model.ConditionalOrderFailureCode;
import com.papervest.conditionalorder.model.ConditionalOrderStatus;
import com.papervest.conditionalorder.model.ConditionalOrderStatusEvent;
import com.papervest.conditionalorder.repository.ConditionalOrderRepository;
import com.papervest.conditionalorder.repository.ConditionalOrderStatusEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Service
public class ConditionalOrderTransitionService {

	private final ConditionalOrderRepository conditionalOrderRepository;
	private final ConditionalOrderStatusEventRepository statusEventRepository;
	private final ObjectMapper objectMapper;

	public ConditionalOrderTransitionService(
			ConditionalOrderRepository conditionalOrderRepository,
			ConditionalOrderStatusEventRepository statusEventRepository,
			ObjectMapper objectMapper
	) {
		this.conditionalOrderRepository = conditionalOrderRepository;
		this.statusEventRepository = statusEventRepository;
		this.objectMapper = objectMapper;
	}

	@Transactional
	public void recordCreated(ConditionalOrder order) {
		statusEventRepository.save(new ConditionalOrderStatusEvent(
				order.getId(),
				null,
				ConditionalOrderStatus.ACTIVE,
				"ORDER_CREATED",
				"Conditional order created",
				null
		));
	}

	@Transactional
	public void touchLastCheckedPrice(ConditionalOrder order, BigDecimal lastCheckedPrice) {
		conditionalOrderRepository.updateLastCheckedPrice(order.getId(), lastCheckedPrice);
	}

	@Transactional
	public boolean markTriggered(ConditionalOrder order, BigDecimal lastCheckedPrice, Map<String, Object> metadata) {
		return advance(
				order,
				ConditionalOrderStatus.TRIGGERED,
				null,
				null,
				lastCheckedPrice,
				Instant.now(),
				null,
				"TARGET_PRICE_REACHED",
				"Target price condition was met",
				metadata
		);
	}

	@Transactional
	public boolean markExecuting(ConditionalOrder order, Map<String, Object> metadata) {
		return advance(
				order,
				ConditionalOrderStatus.EXECUTING,
				null,
				null,
				order.getLastCheckedPrice(),
				order.getTriggeredAt(),
				null,
				"EXECUTION_STARTED",
				"Conditional order execution started",
				metadata
		);
	}

	@Transactional
	public boolean reactivate(
			ConditionalOrder order,
			BigDecimal lastCheckedPrice,
			String reasonCode,
			String reasonMessage,
			Map<String, Object> metadata
	) {
		return advance(
				order,
				ConditionalOrderStatus.ACTIVE,
				null,
				null,
				lastCheckedPrice,
				null,
				null,
				reasonCode,
				reasonMessage,
				metadata
		);
	}

	@Transactional
	public boolean markFilled(
			ConditionalOrder order,
			BigDecimal lastCheckedPrice,
			Instant executedAt,
			String reasonCode,
			String reasonMessage,
			Map<String, Object> metadata
	) {
		return advance(
				order,
				ConditionalOrderStatus.FILLED,
				null,
				null,
				lastCheckedPrice,
				order.getTriggeredAt(),
				executedAt,
				reasonCode,
				reasonMessage,
				metadata
		);
	}

	@Transactional
	public boolean markFailed(
			ConditionalOrder order,
			ConditionalOrderFailureCode failureCode,
			String failureMessage,
			BigDecimal lastCheckedPrice,
			Map<String, Object> metadata
	) {
		return advance(
				order,
				ConditionalOrderStatus.FAILED,
				failureCode,
				failureMessage,
				lastCheckedPrice,
				order.getTriggeredAt(),
				order.getExecutedAt(),
				failureCode.name(),
				failureMessage,
				metadata
		);
	}

	@Transactional
	public boolean cancel(ConditionalOrder order) {
		return advance(
				order,
				ConditionalOrderStatus.CANCELLED,
				ConditionalOrderFailureCode.ORDER_CANCELLED,
				"Order was cancelled by the user",
				order.getLastCheckedPrice(),
				order.getTriggeredAt(),
				order.getExecutedAt(),
				"ORDER_CANCELLED",
				"Order was cancelled by the user",
				null
		);
	}

	@Transactional
	public boolean expire(ConditionalOrder order) {
		return advance(
				order,
				ConditionalOrderStatus.EXPIRED,
				ConditionalOrderFailureCode.ORDER_EXPIRED,
				"Order expired before it could be executed",
				order.getLastCheckedPrice(),
				order.getTriggeredAt(),
				order.getExecutedAt(),
				"ORDER_EXPIRED",
				"Order expired before it could be executed",
				Map.of("expiresAt", order.getExpiresAt())
		);
	}

	private boolean advance(
			ConditionalOrder order,
			ConditionalOrderStatus toStatus,
			ConditionalOrderFailureCode failureCode,
			String failureMessage,
			BigDecimal lastCheckedPrice,
			Instant triggeredAt,
			Instant executedAt,
			String reasonCode,
			String reasonMessage,
			Map<String, Object> metadata
	) {
		Instant now = Instant.now();
		int updated = conditionalOrderRepository.advanceState(
				order.getId(),
				order.getStatus(),
				toStatus,
				order.getVersion(),
				failureCode,
				failureMessage,
				lastCheckedPrice,
				triggeredAt,
				executedAt,
				now
		);
		if (updated == 0) {
			return false;
		}

		statusEventRepository.save(new ConditionalOrderStatusEvent(
				order.getId(),
				order.getStatus(),
				toStatus,
				reasonCode,
				reasonMessage,
				toMetadataJson(metadata)
		));
		return true;
	}

	private String toMetadataJson(Map<String, Object> metadata) {
		if (metadata == null || metadata.isEmpty()) {
			return null;
		}
		try {
			return objectMapper.writeValueAsString(metadata);
		}
		catch (JsonProcessingException ex) {
			throw new IllegalStateException("Unable to serialize conditional order event metadata", ex);
		}
	}
}

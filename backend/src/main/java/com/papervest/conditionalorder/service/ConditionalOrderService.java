package com.papervest.conditionalorder.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.exception.ConflictException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.SymbolUtils;
import com.papervest.conditionalorder.dto.ConditionalOrderDetailResponse;
import com.papervest.conditionalorder.dto.ConditionalOrderListResponse;
import com.papervest.conditionalorder.dto.ConditionalOrderResponse;
import com.papervest.conditionalorder.dto.ConditionalOrderStatusEventResponse;
import com.papervest.conditionalorder.dto.CreateConditionalOrderRequest;
import com.papervest.conditionalorder.model.ConditionalOrder;
import com.papervest.conditionalorder.model.ConditionalOrderStatus;
import com.papervest.conditionalorder.model.ConditionalOrderStatusEvent;
import com.papervest.conditionalorder.repository.ConditionalOrderRepository;
import com.papervest.conditionalorder.repository.ConditionalOrderStatusEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ConditionalOrderService {

	private static final Logger log = LoggerFactory.getLogger(ConditionalOrderService.class);

	private final ConditionalOrderRepository conditionalOrderRepository;
	private final ConditionalOrderStatusEventRepository statusEventRepository;
	private final ConditionalOrderTransitionService transitionService;
	private final ObjectMapper objectMapper;
	private final Clock clock;

	public ConditionalOrderService(
			ConditionalOrderRepository conditionalOrderRepository,
			ConditionalOrderStatusEventRepository statusEventRepository,
			ConditionalOrderTransitionService transitionService,
			ObjectMapper objectMapper,
			Clock clock
	) {
		this.conditionalOrderRepository = conditionalOrderRepository;
		this.statusEventRepository = statusEventRepository;
		this.transitionService = transitionService;
		this.objectMapper = objectMapper;
		this.clock = clock;
	}

	@Transactional
	public ConditionalOrderResponse create(UUID userId, CreateConditionalOrderRequest request) {
		if (request.expiresAt() != null && !request.expiresAt().isAfter(clock.instant())) {
			throw new ConflictException("ORDER_EXPIRED", "Expiration must be in the future");
		}

		ConditionalOrder order = conditionalOrderRepository.save(new ConditionalOrder(
				userId,
				SymbolUtils.normalize(request.symbol()),
				request.side(),
				request.targetPrice(),
				request.quantity(),
				request.expiresAt()
		));
		transitionService.recordCreated(order);
		log.info(
				"Conditional order created orderId={} userId={} symbol={} side={} targetPrice={} quantity={} executionKey={}",
				order.getId(),
				userId,
				order.getSymbol(),
				order.getSide(),
				order.getTargetPrice(),
				order.getQuantity(),
				order.getExecutionKey()
		);
		return toResponse(order);
	}

	@Transactional(readOnly = true)
	public ConditionalOrderListResponse list(UUID userId) {
		return new ConditionalOrderListResponse(
				conditionalOrderRepository.findByUserIdOrderByCreatedAtDesc(userId)
						.stream()
						.map(this::toResponse)
						.toList()
		);
	}

	@Transactional(readOnly = true)
	public ConditionalOrderDetailResponse detail(UUID userId, UUID orderId) {
		ConditionalOrder order = requireOwnedOrder(userId, orderId);
		List<ConditionalOrderStatusEventResponse> events = statusEventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(orderId)
				.stream()
				.map(this::toEventResponse)
				.toList();
		return new ConditionalOrderDetailResponse(toResponse(order), events);
	}

	@Transactional
	public ConditionalOrderResponse cancel(UUID userId, UUID orderId) {
		ConditionalOrder order = requireOwnedOrder(userId, orderId);
		if (order.getStatus() != ConditionalOrderStatus.ACTIVE) {
			throw new ConflictException("ORDER_NOT_ACTIVE", "Only active conditional orders can be cancelled");
		}
		if (!transitionService.cancel(order)) {
			throw new ConflictException("ORDER_NOT_ACTIVE", "This conditional order is no longer active");
		}
		log.info("Conditional order cancelled orderId={} userId={}", orderId, userId);
		return detail(userId, orderId).order();
	}

	@Transactional(readOnly = true)
	public ConditionalOrder requireOrder(UUID orderId) {
		return conditionalOrderRepository.findById(orderId)
				.orElseThrow(() -> new ResourceNotFoundException("CONDITIONAL_ORDER_NOT_FOUND", "Conditional order could not be found"));
	}

	@Transactional(readOnly = true)
	public List<ConditionalOrder> listActiveBatch(int batchSize) {
		return conditionalOrderRepository.findByStatusOrderByCreatedAtAsc(
				ConditionalOrderStatus.ACTIVE,
				PageRequest.of(0, batchSize)
		);
	}

	private ConditionalOrder requireOwnedOrder(UUID userId, UUID orderId) {
		return conditionalOrderRepository.findByIdAndUserId(orderId, userId)
				.orElseThrow(() -> new ResourceNotFoundException("CONDITIONAL_ORDER_NOT_FOUND", "Conditional order could not be found"));
	}

	private ConditionalOrderResponse toResponse(ConditionalOrder order) {
		return new ConditionalOrderResponse(
				order.getId().toString(),
				order.getSymbol(),
				order.getSide(),
				order.getTriggerType(),
				order.getTargetPrice(),
				order.getQuantity(),
				order.getStatus(),
				order.getFailureCode(),
				order.getFailureMessage(),
				order.getExecutionKey(),
				order.getLastCheckedPrice(),
				order.getTriggeredAt(),
				order.getExecutedAt(),
				order.getExpiresAt(),
				order.getCreatedAt(),
				order.getUpdatedAt(),
				order.getVersion()
		);
	}

	private ConditionalOrderStatusEventResponse toEventResponse(ConditionalOrderStatusEvent event) {
		return new ConditionalOrderStatusEventResponse(
				event.getId().toString(),
				event.getFromStatus(),
				event.getToStatus(),
				event.getReasonCode(),
				event.getReasonMessage(),
				parseMetadata(event.getMetadataJson()),
				event.getCreatedAt()
		);
	}

	private Map<String, Object> parseMetadata(String metadataJson) {
		if (metadataJson == null || metadataJson.isBlank()) {
			return Map.of();
		}
		try {
			return objectMapper.readValue(metadataJson, new TypeReference<>() {
			});
		}
		catch (IOException ex) {
			return Map.of("raw", metadataJson);
		}
	}
}

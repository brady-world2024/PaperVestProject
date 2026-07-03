package com.papervest.orders.service;

import com.papervest.orders.dto.OrderDetailResponse;
import com.papervest.orders.dto.OrderExecutionSummaryResponse;
import com.papervest.orders.dto.OrderListResponse;
import com.papervest.orders.dto.OrderResponse;
import com.papervest.orders.dto.OrderStatusEventResponse;
import com.papervest.orders.execution.model.OrderExecutionRequest;
import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderStatusEvent;

import java.util.List;
import java.util.Map;
import java.util.UUID;

final class OrderMapper {

	private OrderMapper() {
	}

	static OrderListResponse toListResponse(List<Order> orders) {
		return new OrderListResponse(orders.stream().map(OrderMapper::toResponse).toList());
	}

	static OrderListResponse toListResponse(List<Order> orders, Map<UUID, OrderExecutionRequest> executionRequestsByOrderId) {
		return new OrderListResponse(orders.stream()
				.map(order -> toResponse(order, executionRequestsByOrderId.get(order.getId())))
				.toList());
	}

	static OrderDetailResponse toDetailResponse(Order order, List<OrderStatusEvent> events) {
		return new OrderDetailResponse(
				toResponse(order),
				events.stream().map(OrderMapper::toEventResponse).toList()
		);
	}

	static OrderDetailResponse toDetailResponse(
			Order order,
			List<OrderStatusEvent> events,
			OrderExecutionRequest executionRequest
	) {
		return new OrderDetailResponse(
				toResponse(order, executionRequest),
				events.stream().map(OrderMapper::toEventResponse).toList()
		);
	}

	static OrderResponse toResponse(Order order) {
		return toResponse(order, null);
	}

	static OrderResponse toResponse(Order order, OrderExecutionRequest executionRequest) {
		return new OrderResponse(
				order.getId(),
				order.getSymbol(),
				order.getCompanyName(),
				order.getSide(),
				order.getOrderType(),
				order.getTimeInForce(),
				order.getStatus(),
				order.getSource(),
				order.getSourceRefId(),
				order.getRequestedQuantity(),
				order.getFilledQuantity(),
				order.getLimitPrice(),
				order.getStopPrice(),
				order.getEstimatedGrossAmount(),
				order.getReservedCashAmount(),
				order.getReservedQuantity(),
				order.getRejectionCode(),
				order.getRejectionMessage(),
				order.getSubmittedAt(),
				order.getAcceptedAt(),
				order.getCompletedAt(),
				order.getCancelledAt(),
				order.getExpiresAt(),
				order.getCreatedAt(),
				order.getUpdatedAt(),
				toExecutionSummary(executionRequest)
		);
	}

	private static OrderExecutionSummaryResponse toExecutionSummary(OrderExecutionRequest request) {
		if (request == null) {
			return null;
		}
		return new OrderExecutionSummaryResponse(
				request.getId(),
				request.getStatus(),
				request.getTriggerPrice(),
				request.getExecutionPrice(),
				request.getQuoteTimestamp(),
				request.getPublishedAt(),
				request.getConsumedAt(),
				request.getLastPublishError(),
				request.getPublishAttemptCount(),
				request.getCreatedAt(),
				request.getUpdatedAt()
		);
	}

	private static OrderStatusEventResponse toEventResponse(OrderStatusEvent event) {
		return new OrderStatusEventResponse(
				event.getId(),
				event.getFromStatus(),
				event.getToStatus(),
				event.getReasonCode(),
				event.getReasonMessage(),
				event.getMetadataJson(),
				event.getCreatedAt()
		);
	}
}

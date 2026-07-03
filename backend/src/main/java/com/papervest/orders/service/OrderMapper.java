package com.papervest.orders.service;

import com.papervest.orders.dto.OrderDetailResponse;
import com.papervest.orders.dto.OrderListResponse;
import com.papervest.orders.dto.OrderResponse;
import com.papervest.orders.dto.OrderStatusEventResponse;
import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderStatusEvent;

import java.util.List;

final class OrderMapper {

	private OrderMapper() {
	}

	static OrderListResponse toListResponse(List<Order> orders) {
		return new OrderListResponse(orders.stream().map(OrderMapper::toResponse).toList());
	}

	static OrderDetailResponse toDetailResponse(Order order, List<OrderStatusEvent> events) {
		return new OrderDetailResponse(
				toResponse(order),
				events.stream().map(OrderMapper::toEventResponse).toList()
		);
	}

	static OrderResponse toResponse(Order order) {
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
				order.getUpdatedAt()
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

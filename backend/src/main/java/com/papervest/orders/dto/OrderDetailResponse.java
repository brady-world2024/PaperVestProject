package com.papervest.orders.dto;

import java.util.List;

public record OrderDetailResponse(
		OrderResponse order,
		List<OrderStatusEventResponse> events
) {
}

package com.papervest.orders.dto;

import java.util.List;

public record OrderListResponse(List<OrderResponse> orders) {
}

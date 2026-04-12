package com.papervest.conditionalorder.dto;

import java.util.List;

public record ConditionalOrderListResponse(List<ConditionalOrderResponse> orders) {
}

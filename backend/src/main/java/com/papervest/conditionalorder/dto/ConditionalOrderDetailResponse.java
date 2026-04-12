package com.papervest.conditionalorder.dto;

import java.util.List;

public record ConditionalOrderDetailResponse(
		ConditionalOrderResponse order,
		List<ConditionalOrderStatusEventResponse> events
) {
}

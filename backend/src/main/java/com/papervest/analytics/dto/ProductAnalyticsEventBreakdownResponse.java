package com.papervest.analytics.dto;

import com.papervest.analytics.model.ProductAnalyticsEventName;

public record ProductAnalyticsEventBreakdownResponse(
		ProductAnalyticsEventName eventName,
		long count
) {
}

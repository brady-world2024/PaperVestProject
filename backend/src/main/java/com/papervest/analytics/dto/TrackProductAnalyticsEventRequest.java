package com.papervest.analytics.dto;

import com.papervest.analytics.model.ProductAnalyticsEventName;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;

public record TrackProductAnalyticsEventRequest(
		@NotNull ProductAnalyticsEventName eventName,
		@Size(max = 255) String path,
		Map<String, Object> metadata
) {
}

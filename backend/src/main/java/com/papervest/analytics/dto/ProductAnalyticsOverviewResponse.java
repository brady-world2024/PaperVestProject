package com.papervest.analytics.dto;

import java.time.Instant;
import java.util.List;

public record ProductAnalyticsOverviewResponse(
		int windowDays,
		Instant from,
		Instant to,
		ProductAnalyticsSummaryResponse summary,
		List<ProductAnalyticsDailyActivityPointResponse> dailyActivity,
		List<ProductAnalyticsTopPageResponse> topPages,
		List<ProductAnalyticsEventBreakdownResponse> eventBreakdown,
		ProductAnalyticsFunnelResponse funnel
) {
}

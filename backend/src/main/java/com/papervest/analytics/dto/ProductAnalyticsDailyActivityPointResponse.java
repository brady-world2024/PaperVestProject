package com.papervest.analytics.dto;

import java.time.LocalDate;

public record ProductAnalyticsDailyActivityPointResponse(
		LocalDate day,
		long totalEvents,
		long uniqueUsers,
		long pageViews,
		long stockSearches,
		long registrations,
		long logins,
		long tradesExecuted,
		long conditionalOrdersCreated
) {
}

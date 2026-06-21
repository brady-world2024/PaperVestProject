package com.papervest.analytics.dto;

public record ProductAnalyticsSummaryResponse(
		long totalEvents,
		long uniqueUsers,
		long pageViews,
		long stockSearches,
		long registrations,
		long logins,
		long tradesExecuted,
		long conditionalOrdersCreated,
		long conditionalOrdersCancelled,
		long watchlistAdds,
		long watchlistRemovals
) {
}

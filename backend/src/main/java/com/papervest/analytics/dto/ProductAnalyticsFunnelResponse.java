package com.papervest.analytics.dto;

public record ProductAnalyticsFunnelResponse(
		long usersSeen,
		long usersWithPageViews,
		long usersWithSearches,
		long usersWithWatchlistActivity,
		long usersWithTrades,
		long usersWithConditionalOrders
) {
}

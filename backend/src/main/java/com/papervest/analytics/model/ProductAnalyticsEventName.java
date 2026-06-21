package com.papervest.analytics.model;

public enum ProductAnalyticsEventName {
	PAGE_VIEWED,
	STOCK_SEARCH_PERFORMED,
	USER_REGISTERED,
	USER_LOGGED_IN,
	WATCHLIST_ITEM_ADDED,
	WATCHLIST_ITEM_REMOVED,
	TRADE_EXECUTED,
	CONDITIONAL_ORDER_CREATED,
	CONDITIONAL_ORDER_CANCELLED;

	public boolean isWebTrackable() {
		return this == PAGE_VIEWED || this == STOCK_SEARCH_PERFORMED;
	}
}

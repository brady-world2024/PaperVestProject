package com.papervest.adminsupport.dto;

import com.papervest.conditionalorder.dto.ConditionalOrderResponse;
import com.papervest.notification.dto.NotificationResponse;
import com.papervest.trading.dto.TradeExecutionResponse;

import java.util.List;

public record SupportUserDetailResponse(
		SupportUserProfileResponse user,
		SupportAccountSummaryResponse account,
		int holdingsCount,
		int watchlistCount,
		int activeConditionalOrdersCount,
		int activeSessionsCount,
		long unreadNotificationsCount,
		List<SupportHoldingResponse> holdings,
		List<SupportWatchlistItemResponse> watchlist,
		List<SupportSessionResponse> activeSessions,
		List<TradeExecutionResponse> recentTrades,
		List<ConditionalOrderResponse> activeConditionalOrders,
		List<NotificationResponse> recentNotifications
) {
}

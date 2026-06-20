package com.papervest.adminsupport.dto;

import com.papervest.user.model.UserRole;

import java.math.BigDecimal;
import java.time.Instant;

public record SupportUserSummaryResponse(
		String userId,
		String email,
		UserRole role,
		boolean emailVerified,
		Instant createdAt,
		BigDecimal cashBalance,
		BigDecimal realizedPnl,
		int holdingsCount,
		int watchlistCount,
		int activeConditionalOrdersCount,
		int activeSessionsCount,
		long unreadNotificationsCount,
		Instant lastTradeAt
) {
}

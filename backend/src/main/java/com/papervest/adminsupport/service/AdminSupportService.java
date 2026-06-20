package com.papervest.adminsupport.service;

import com.papervest.adminsupport.dto.SupportAccountSummaryResponse;
import com.papervest.adminsupport.dto.SupportHoldingResponse;
import com.papervest.adminsupport.dto.SupportSessionResponse;
import com.papervest.adminsupport.dto.SupportUserDetailResponse;
import com.papervest.adminsupport.dto.SupportUserListResponse;
import com.papervest.adminsupport.dto.SupportUserProfileResponse;
import com.papervest.adminsupport.dto.SupportUserSummaryResponse;
import com.papervest.adminsupport.dto.SupportWatchlistItemResponse;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.MoneyUtils;
import com.papervest.conditionalorder.dto.ConditionalOrderResponse;
import com.papervest.conditionalorder.model.ConditionalOrder;
import com.papervest.conditionalorder.model.ConditionalOrderStatus;
import com.papervest.conditionalorder.repository.ConditionalOrderRepository;
import com.papervest.notification.dto.NotificationResponse;
import com.papervest.notification.model.UserNotification;
import com.papervest.notification.repository.UserNotificationRepository;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import com.papervest.trading.dto.TradeExecutionResponse;
import com.papervest.trading.model.Holding;
import com.papervest.trading.model.Trade;
import com.papervest.trading.repository.HoldingRepository;
import com.papervest.trading.repository.TradeRepository;
import com.papervest.watchlist.model.WatchlistItem;
import com.papervest.watchlist.repository.WatchlistItemRepository;
import com.papervest.auth.model.RefreshToken;
import com.papervest.auth.repository.RefreshTokenRepository;
import com.papervest.user.model.User;
import com.papervest.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AdminSupportService {

	private final UserRepository userRepository;
	private final UserAccountRepository userAccountRepository;
	private final HoldingRepository holdingRepository;
	private final TradeRepository tradeRepository;
	private final WatchlistItemRepository watchlistItemRepository;
	private final ConditionalOrderRepository conditionalOrderRepository;
	private final RefreshTokenRepository refreshTokenRepository;
	private final UserNotificationRepository userNotificationRepository;
	private final Clock clock;

	public AdminSupportService(
			UserRepository userRepository,
			UserAccountRepository userAccountRepository,
			HoldingRepository holdingRepository,
			TradeRepository tradeRepository,
			WatchlistItemRepository watchlistItemRepository,
			ConditionalOrderRepository conditionalOrderRepository,
			RefreshTokenRepository refreshTokenRepository,
			UserNotificationRepository userNotificationRepository,
			Clock clock
	) {
		this.userRepository = userRepository;
		this.userAccountRepository = userAccountRepository;
		this.holdingRepository = holdingRepository;
		this.tradeRepository = tradeRepository;
		this.watchlistItemRepository = watchlistItemRepository;
		this.conditionalOrderRepository = conditionalOrderRepository;
		this.refreshTokenRepository = refreshTokenRepository;
		this.userNotificationRepository = userNotificationRepository;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public SupportUserListResponse listUsers(String query) {
		List<User> users = normalizeQuery(query) == null
				? userRepository.findTop25ByOrderByCreatedAtDesc()
				: userRepository.findTop25ByEmailContainingIgnoreCaseOrderByCreatedAtDesc(normalizeQuery(query));

		return new SupportUserListResponse(users.stream().map(this::toSummary).toList());
	}

	@Transactional(readOnly = true)
	public SupportUserDetailResponse userDetail(UUID userId) {
		User user = requireUser(userId);
		UserAccount account = userAccountRepository.findByUserId(userId).orElse(null);
		List<Holding> holdings = holdingRepository.findByUserIdOrderBySymbolAsc(userId);
		List<WatchlistItem> watchlistItems = watchlistItemRepository.findByUserIdOrderByCreatedAtDesc(userId);
		List<ConditionalOrder> openOrders = conditionalOrderRepository.findByUserIdOrderByCreatedAtDesc(userId)
				.stream()
				.filter(this::isOpenConditionalOrder)
				.limit(10)
				.toList();
		List<RefreshToken> activeSessions = refreshTokenRepository.findTop10ByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId)
				.stream()
				.filter(this::isUsableSession)
				.toList();
		List<TradeExecutionResponse> recentTrades = tradeRepository.findTop10ByUserIdOrderByExecutedAtDesc(userId)
				.stream()
				.map(this::toTradeResponse)
				.toList();
		List<NotificationResponse> recentNotifications = userNotificationRepository.findTop10ByUserIdOrderByCreatedAtDesc(userId)
				.stream()
				.map(this::toNotificationResponse)
				.toList();

		return new SupportUserDetailResponse(
				toProfile(user),
				toAccountSummary(account),
				holdings.size(),
				watchlistItems.size(),
				openOrders.size(),
				activeSessions.size(),
				userNotificationRepository.countByUserIdAndReadAtIsNull(userId),
				holdings.stream().map(this::toHoldingResponse).toList(),
				watchlistItems.stream().map(this::toWatchlistResponse).toList(),
				activeSessions.stream().map(this::toSessionResponse).toList(),
				recentTrades,
				openOrders.stream().map(this::toConditionalOrderResponse).toList(),
				recentNotifications
		);
	}

	private SupportUserSummaryResponse toSummary(User user) {
		UUID userId = user.getId();
		UserAccount account = userAccountRepository.findByUserId(userId).orElse(null);
		int holdingsCount = holdingRepository.findByUserIdOrderBySymbolAsc(userId).size();
		int watchlistCount = watchlistItemRepository.findByUserIdOrderByCreatedAtDesc(userId).size();
		int activeConditionalOrdersCount = (int) conditionalOrderRepository.findByUserIdOrderByCreatedAtDesc(userId)
				.stream()
				.filter(this::isOpenConditionalOrder)
				.count();
		int activeSessionsCount = (int) refreshTokenRepository.findAllByUserIdAndRevokedAtIsNull(userId)
				.stream()
				.filter(this::isUsableSession)
				.count();
		long unreadNotificationsCount = userNotificationRepository.countByUserIdAndReadAtIsNull(userId);
		Instant lastTradeAt = tradeRepository.findTop1ByUserIdOrderByExecutedAtDesc(userId)
				.map(Trade::getExecutedAt)
				.orElse(null);

		return new SupportUserSummaryResponse(
				userId.toString(),
				user.getEmail(),
				user.getRole(),
				user.isEmailVerified(),
				user.getCreatedAt(),
				account == null ? zeroMoney() : account.getCashBalance(),
				account == null ? zeroMoney() : account.getRealizedPnl(),
				holdingsCount,
				watchlistCount,
				activeConditionalOrdersCount,
				activeSessionsCount,
				unreadNotificationsCount,
				lastTradeAt
		);
	}

	private SupportUserProfileResponse toProfile(User user) {
		return new SupportUserProfileResponse(
				user.getId().toString(),
				user.getEmail(),
				user.getRole(),
				user.isEmailVerified(),
				user.getEmailVerifiedAt(),
				user.getCreatedAt()
		);
	}

	private SupportAccountSummaryResponse toAccountSummary(UserAccount account) {
		if (account == null) {
			return new SupportAccountSummaryResponse(zeroMoney(), zeroMoney(), zeroMoney());
		}
		return new SupportAccountSummaryResponse(
				account.getInitialCash(),
				account.getCashBalance(),
				account.getRealizedPnl()
		);
	}

	private SupportHoldingResponse toHoldingResponse(Holding holding) {
		return new SupportHoldingResponse(
				holding.getSymbol(),
				holding.getCompanyName(),
				holding.getQuantity(),
				holding.getAverageCost()
		);
	}

	private SupportWatchlistItemResponse toWatchlistResponse(WatchlistItem item) {
		return new SupportWatchlistItemResponse(item.getSymbol(), item.getCompanyName(), item.getCreatedAt());
	}

	private SupportSessionResponse toSessionResponse(RefreshToken token) {
		return new SupportSessionResponse(
				token.getId().toString(),
				token.getDeviceName() == null || token.getDeviceName().isBlank() ? "Unknown device" : token.getDeviceName(),
				token.getCreatedAt(),
				token.getLastUsedAt(),
				token.getExpiresAt()
		);
	}

	private TradeExecutionResponse toTradeResponse(Trade trade) {
		return new TradeExecutionResponse(
				trade.getId(),
				trade.getSymbol(),
				trade.getCompanyName(),
				trade.getSide(),
				trade.getQuantity(),
				trade.getExecutedPrice(),
				trade.getGrossAmount(),
				trade.getRealizedPnl(),
				trade.getCashBalanceAfterTrade(),
				trade.getExecutedAt(),
				false
		);
	}

	private ConditionalOrderResponse toConditionalOrderResponse(ConditionalOrder order) {
		return new ConditionalOrderResponse(
				order.getId().toString(),
				order.getSymbol(),
				order.getSide(),
				order.getTriggerType(),
				order.getTargetPrice(),
				order.getQuantity(),
				order.getStatus(),
				order.getFailureCode(),
				order.getFailureMessage(),
				order.getExecutionKey(),
				order.getLastCheckedPrice(),
				order.getTriggeredAt(),
				order.getExecutedAt(),
				order.getExpiresAt(),
				order.getCreatedAt(),
				order.getUpdatedAt(),
				order.getVersion()
		);
	}

	private NotificationResponse toNotificationResponse(UserNotification notification) {
		return new NotificationResponse(
				notification.getId().toString(),
				notification.getType(),
				notification.getTitle(),
				notification.getMessage(),
				notification.getActionPath(),
				notification.isRead(),
				notification.getReadAt(),
				notification.getCreatedAt()
		);
	}

	private User requireUser(UUID userId) {
		return userRepository.findById(userId)
				.orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND", "User account could not be found"));
	}

	private boolean isOpenConditionalOrder(ConditionalOrder order) {
		return order.getStatus() == ConditionalOrderStatus.ACTIVE
				|| order.getStatus() == ConditionalOrderStatus.TRIGGERED
				|| order.getStatus() == ConditionalOrderStatus.EXECUTING;
	}

	private boolean isUsableSession(RefreshToken token) {
		return token.isActiveAt(clock.instant());
	}

	private String normalizeQuery(String query) {
		if (query == null || query.isBlank()) {
			return null;
		}
		return query.trim();
	}

	private BigDecimal zeroMoney() {
		return BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE);
	}
}

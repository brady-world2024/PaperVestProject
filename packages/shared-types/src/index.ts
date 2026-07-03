export type MarketSessionState = 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS';

export type MarketSessionPresentation = {
  statusLabel: string;
  priceLabel: string;
  changeLabel: string;
};

export function getMarketSessionPresentation(
  session: MarketSessionState
): MarketSessionPresentation {
  switch (session) {
    case 'OPEN':
      return {
        statusLabel: 'Open',
        priceLabel: 'Real-time price',
        changeLabel: 'vs previous close',
      };
    case 'PRE_MARKET':
      return {
        statusLabel: 'Pre-Market',
        priceLabel: 'Pre-market price',
        changeLabel: 'Pre-market change',
      };
    case 'AFTER_HOURS':
      return {
        statusLabel: 'After Hours',
        priceLabel: 'After-hours price',
        changeLabel: 'After-hours change',
      };
    case 'CLOSED':
    default:
      return {
        statusLabel: 'Closed',
        priceLabel: 'Last price · Market closed',
        changeLabel: 'vs previous close',
      };
  }
}

export type ApiFieldError = {
  field: string;
  message: string;
};

export type ApiErrorResponse = {
  code: string;
  message: string;
  path: string;
  requestId: string;
  timestamp: string;
  fieldErrors?: ApiFieldError[];
};

export type UserRole = 'USER' | 'ADMIN';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  user: AuthUser;
};

export type AuthSession = AuthResponse;

export type SessionResponse = {
  user: AuthUser;
};

export type LoginPayload = {
  email: string;
  password: string;
  deviceName?: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  confirmPassword: string;
  deviceName?: string;
};

export type RequestPasswordResetPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  token: string;
  password: string;
  confirmPassword: string;
};

export type ConfirmEmailVerificationPayload = {
  token: string;
};

export type LogoutPayload = {
  refreshToken?: string;
};

export type RefreshTokenPayload = {
  refreshToken?: string;
  deviceName?: string;
};

export type Quote = {
  symbol: string;
  companyName: string;
  currentPrice: number;
  dailyChange: number;
  dailyChangePercent: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  previousClose: number;
  quoteTimestamp: string;
  stale: boolean;
  marketSession: MarketSessionState;
  tradingEnabled: boolean;
  marketTimezone: string;
};

export type HomeMarketResponse = {
  quotes: Quote[];
  degraded: boolean;
};

export type ProductAnalyticsWindowDays = 7 | 30 | 90;

export type ProductAnalyticsEventName =
  | 'PAGE_VIEWED'
  | 'STOCK_SEARCH_PERFORMED'
  | 'USER_REGISTERED'
  | 'USER_LOGGED_IN'
  | 'WATCHLIST_ITEM_ADDED'
  | 'WATCHLIST_ITEM_REMOVED'
  | 'TRADE_EXECUTED'
  | 'CONDITIONAL_ORDER_CREATED'
  | 'CONDITIONAL_ORDER_CANCELLED';

export type ProductAnalyticsEventSource = 'WEB_APP' | 'BACKEND_DOMAIN';

export type TrackProductAnalyticsEventPayload = {
  eventName: ProductAnalyticsEventName;
  path?: string | null;
  metadata?: Record<string, unknown>;
};

export type StockSearchResult = {
  symbol: string;
  companyName: string;
  type: string;
};

export type StockSearchResponse = {
  results: StockSearchResult[];
};

export type StockHistoryRange = '1D' | '1W' | '1M' | '3M' | '1Y';

export type StockPriceBar = {
  timestamp: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
};

export type StockPriceHistory = {
  symbol: string;
  range: StockHistoryRange;
  interval: string;
  from: string;
  to: string;
  points: StockPriceBar[];
};

export type WatchlistItem = {
  symbol: string;
  companyName: string;
  currentPrice: number | null;
  dailyChange: number | null;
  dailyChangePercent: number | null;
  quoteTimestamp: string | null;
  staleQuote: boolean;
  marketSession: MarketSessionState | null;
  tradingEnabled: boolean;
  marketTimezone: string | null;
  addedAt: string;
};

export type WatchlistResponse = {
  items: WatchlistItem[];
};

export type Holding = {
  symbol: string;
  companyName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  averageCost: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  dailyChange: number;
  staleQuote: boolean;
  quoteTimestamp: string | null;
  marketSession: MarketSessionState | null;
  tradingEnabled: boolean;
  marketTimezone: string | null;
};

export type PortfolioSummary = {
  initialCash: number;
  cashBalance: number;
  reservedCashBalance: number;
  availableCashBalance: number;
  holdingsMarketValue: number;
  totalPortfolioValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  totalReturnPercent: number;
  dailyChange: number;
};

export type PortfolioResponse = {
  summary: PortfolioSummary;
  holdings: Holding[];
};

export type PortfolioHistoryRange = '1W' | '1M' | '3M' | 'ALL';

export type PortfolioSnapshotSource = 'TRADE_EXECUTION';

export type PortfolioHistoryPoint = {
  timestamp: string;
  totalPortfolioValue: number;
  cashBalance: number;
  holdingsMarketValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  snapshotSource: PortfolioSnapshotSource;
};

export type PortfolioHistoryResponse = {
  range: PortfolioHistoryRange;
  from: string | null;
  to: string;
  points: PortfolioHistoryPoint[];
};

export type NotificationType =
  | 'CONDITIONAL_ORDER_CREATED'
  | 'CONDITIONAL_ORDER_TRIGGERED'
  | 'CONDITIONAL_ORDER_FILLED'
  | 'CONDITIONAL_ORDER_FAILED'
  | 'CONDITIONAL_ORDER_CANCELLED'
  | 'CONDITIONAL_ORDER_EXPIRED'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_CHANGED';

export type UserNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionPath: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  unreadCount: number;
  notifications: UserNotification[];
};

export type AccountProfile = {
  userId: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type SupportUserSummary = {
  userId: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  cashBalance: number;
  realizedPnl: number;
  holdingsCount: number;
  watchlistCount: number;
  activeConditionalOrdersCount: number;
  activeSessionsCount: number;
  unreadNotificationsCount: number;
  lastTradeAt: string | null;
};

export type SupportUserListResponse = {
  users: SupportUserSummary[];
};

export type SupportUserProfile = {
  userId: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type SupportAccountSummary = {
  initialCash: number;
  cashBalance: number;
  realizedPnl: number;
};

export type SupportHolding = {
  symbol: string;
  companyName: string;
  quantity: number;
  averageCost: number;
};

export type SupportWatchlistItem = {
  symbol: string;
  companyName: string;
  addedAt: string;
};

export type SupportSession = {
  sessionId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  deviceName?: string;
};

export type DeleteAccountPayload = {
  currentPassword: string;
};

export type EmailVerificationResult = {
  email: string;
  emailVerifiedAt: string;
};

export type TradeSide = 'BUY' | 'SELL';

export type TradeOrderPayload = {
  symbol: string;
  companyName?: string;
  quantity: number;
};

export type TradeExecutionResponse = {
  tradeId: string;
  symbol: string;
  companyName: string;
  side: TradeSide;
  quantity: number;
  executedPrice: number;
  grossAmount: number;
  realizedPnl: number;
  cashBalanceAfterTrade: number;
  executedAt: string;
  idempotentReplay: boolean;
  orderId?: string | null;
  orderStatus?: OrderStatus | null;
};

export type TradeHistoryResponse = {
  trades: TradeExecutionResponse[];
};

export type OrderStatus =
  | 'CREATED'
  | 'ACCEPTED'
  | 'PENDING'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED';

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';

export type OrderTimeInForce = 'DAY' | 'GTC' | 'IOC';

export type OrderSource = 'USER' | 'CONDITIONAL_ORDER' | 'SYSTEM';

export type OrderExecutionStatus = 'PENDING' | 'PUBLISHED' | 'CONSUMED' | 'CANCELLED' | 'FAILED';

export type OrderExecutionSummary = {
  id: string;
  status: OrderExecutionStatus;
  triggerPrice: number;
  executionPrice: number;
  quoteTimestamp: string | null;
  publishedAt: string | null;
  consumedAt: string | null;
  lastPublishError: string | null;
  publishAttemptCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderPayload = {
  symbol: string;
  companyName?: string;
  side: TradeSide;
  orderType: OrderType;
  timeInForce: OrderTimeInForce;
  quantity: number;
  limitPrice?: number | null;
  stopPrice?: number | null;
};

export type Order = {
  id: string;
  symbol: string;
  companyName: string;
  side: TradeSide;
  orderType: OrderType;
  timeInForce: OrderTimeInForce;
  status: OrderStatus;
  source: OrderSource;
  sourceRefId: string | null;
  requestedQuantity: number;
  filledQuantity: number;
  limitPrice: number | null;
  stopPrice: number | null;
  estimatedGrossAmount: number | null;
  reservedCashAmount: number;
  reservedQuantity: number;
  rejectionCode: string | null;
  rejectionMessage: string | null;
  submittedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  execution: OrderExecutionSummary | null;
};

export type OrderStatusEvent = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reasonCode: string | null;
  reasonMessage: string | null;
  metadataJson: string | null;
  createdAt: string;
};

export type OrderListResponse = {
  orders: Order[];
};

export type OrderDetailResponse = {
  order: Order;
  events: OrderStatusEvent[];
};

export type ConditionalOrderStatus =
  | 'ACTIVE'
  | 'TRIGGERED'
  | 'EXECUTING'
  | 'FILLED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type ConditionalOrderTriggerType = 'TARGET_PRICE';

export type ConditionalOrderFailureCode =
  | 'INSUFFICIENT_CASH'
  | 'INSUFFICIENT_HOLDINGS'
  | 'MARKET_DATA_UNAVAILABLE'
  | 'ORDER_ALREADY_EXECUTED'
  | 'ORDER_NOT_ACTIVE'
  | 'ORDER_CANCELLED'
  | 'ORDER_EXPIRED'
  | 'PRICE_CONDITION_NOT_MET_ANYMORE'
  | 'MARKET_CLOSED'
  | 'INTERNAL_ERROR';

export type CreateConditionalOrderPayload = {
  symbol: string;
  side: TradeSide;
  targetPrice: number;
  quantity: number;
  expiresAt?: string | null;
};

export type ConditionalOrder = {
  id: string;
  symbol: string;
  side: TradeSide;
  triggerType: ConditionalOrderTriggerType;
  targetPrice: number;
  quantity: number;
  status: ConditionalOrderStatus;
  failureCode: ConditionalOrderFailureCode | null;
  failureMessage: string | null;
  executionKey: string;
  lastCheckedPrice: number | null;
  triggeredAt: string | null;
  executedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ConditionalOrderResponse = ConditionalOrder;

export type ConditionalOrderStatusEvent = {
  id: string;
  fromStatus: ConditionalOrderStatus | null;
  toStatus: ConditionalOrderStatus;
  reasonCode: string | null;
  reasonMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ConditionalOrderListResponse = {
  orders: ConditionalOrder[];
};

export type ConditionalOrderDetailResponse = {
  order: ConditionalOrder;
  events: ConditionalOrderStatusEvent[];
};

export type SupportUserDetailResponse = {
  user: SupportUserProfile;
  account: SupportAccountSummary;
  holdingsCount: number;
  watchlistCount: number;
  activeConditionalOrdersCount: number;
  activeSessionsCount: number;
  unreadNotificationsCount: number;
  holdings: SupportHolding[];
  watchlist: SupportWatchlistItem[];
  activeSessions: SupportSession[];
  recentTrades: TradeExecutionResponse[];
  activeConditionalOrders: ConditionalOrder[];
  recentNotifications: UserNotification[];
};

export type ProductAnalyticsSummary = {
  totalEvents: number;
  uniqueUsers: number;
  pageViews: number;
  stockSearches: number;
  registrations: number;
  logins: number;
  tradesExecuted: number;
  conditionalOrdersCreated: number;
  conditionalOrdersCancelled: number;
  watchlistAdds: number;
  watchlistRemovals: number;
};

export type ProductAnalyticsDailyActivityPoint = {
  day: string;
  totalEvents: number;
  uniqueUsers: number;
  pageViews: number;
  stockSearches: number;
  registrations: number;
  logins: number;
  tradesExecuted: number;
  conditionalOrdersCreated: number;
};

export type ProductAnalyticsTopPage = {
  path: string;
  views: number;
};

export type ProductAnalyticsEventBreakdownEntry = {
  eventName: ProductAnalyticsEventName;
  count: number;
};

export type ProductAnalyticsFunnel = {
  usersSeen: number;
  usersWithPageViews: number;
  usersWithSearches: number;
  usersWithWatchlistActivity: number;
  usersWithTrades: number;
  usersWithConditionalOrders: number;
};

export type ProductAnalyticsOverviewResponse = {
  windowDays: ProductAnalyticsWindowDays;
  from: string;
  to: string;
  summary: ProductAnalyticsSummary;
  dailyActivity: ProductAnalyticsDailyActivityPoint[];
  topPages: ProductAnalyticsTopPage[];
  eventBreakdown: ProductAnalyticsEventBreakdownEntry[];
  funnel: ProductAnalyticsFunnel;
};

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

export type AuthUser = {
  id: string;
  email: string;
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
};

export type HomeMarketResponse = {
  quotes: Quote[];
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
  staleQuote: boolean;
  addedAt: string;
};

export type WatchlistResponse = {
  items: WatchlistItem[];
};

export type Holding = {
  symbol: string;
  companyName: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  dailyChange: number;
  staleQuote: boolean;
};

export type PortfolioSummary = {
  initialCash: number;
  cashBalance: number;
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
};

export type TradeHistoryResponse = {
  trades: TradeExecutionResponse[];
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

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import type {
  AccountProfile,
  ProductAnalyticsOverviewResponse,
  ProductAnalyticsWindowDays,
  TrackProductAnalyticsEventPayload,
  SupportUserDetailResponse,
  SupportUserListResponse,
  ApiErrorResponse,
  AuthResponse,
  ChangePasswordPayload,
  ConfirmEmailVerificationPayload,
  HomeMarketResponse,
  ConditionalOrderDetailResponse,
  ConditionalOrderListResponse,
  ConditionalOrderResponse,
  CreateConditionalOrderPayload,
  CreateOrderPayload,
  DeleteAccountPayload,
  EmailVerificationResult,
  LoginPayload,
  NotificationListResponse,
  Order,
  OrderDetailResponse,
  OrderListResponse,
  PortfolioHistoryRange,
  PortfolioHistoryResponse,
  PortfolioResponse,
  Quote,
  RefreshTokenPayload,
  RequestPasswordResetPayload,
  RegisterPayload,
  ResetPasswordPayload,
  SessionResponse,
  StockHistoryRange,
  StockPriceHistory,
  StockSearchResponse,
  TradeExecutionResponse,
  TradeHistoryResponse,
  TradeOrderPayload,
  WatchlistItem,
  WatchlistResponse,
} from '@papervest/shared-types';

type RequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export type ApiAuthHandlers = {
  getAccessToken?: () => string | null;
  refreshSession: () => Promise<string | null>;
  onAuthenticationFailure: () => Promise<void> | void;
};

export type ApiClientOptions = {
  baseUrl: string;
  timeoutMs?: number;
  authTransport?: 'bearer' | 'cookie';
};

export function createPapervestApiClient({
  baseUrl,
  timeoutMs = 10000,
  authTransport = 'bearer',
}: ApiClientOptions) {
  let authHandlers: ApiAuthHandlers | null = null;
  let refreshPromise: Promise<string | null> | null = null;
  let latestCookieCsrfToken: string | null = null;

  const rawClient = createClient(baseUrl, timeoutMs, authTransport);
  const apiClient = createClient(baseUrl, timeoutMs, authTransport);

  const attachCookieCsrfHeader = (config: RequestConfig) => {
    if (authTransport !== 'cookie') {
      return config;
    }

    const existingHeader = getHeader(config, 'X-XSRF-TOKEN');
    if (existingHeader) {
      return config;
    }

    const csrfToken = resolveCookieCsrfToken();
    if (csrfToken) {
      setHeader(config, 'X-XSRF-TOKEN', csrfToken);
    }

    return config;
  };

  rawClient.interceptors.request.use((config) => attachCookieCsrfHeader(config as RequestConfig));

  apiClient.interceptors.request.use((config) => {
    attachCookieCsrfHeader(config as RequestConfig);
    const token = authTransport === 'bearer' ? authHandlers?.getAccessToken?.() : null;
    if (token && authTransport === 'bearer') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorResponse>) => {
      const originalRequest = error.config as RequestConfig | undefined;

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        authHandlers
      ) {
        originalRequest._retry = true;
        refreshPromise ??= authHandlers.refreshSession();
        const nextAccessToken = await refreshPromise.finally(() => {
          refreshPromise = null;
        });

        if (nextAccessToken) {
          if (authTransport === 'bearer') {
            originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
          }
          return apiClient(originalRequest);
        }

        await authHandlers.onAuthenticationFailure();
      }

      return Promise.reject(error);
    }
  );

  return {
    setAuthHandlers(handlers: ApiAuthHandlers) {
      authHandlers = handlers;
    },
    getApiErrorMessage(error: unknown, fallback = 'Something went wrong') {
      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        return (
          error.response?.data?.message ??
          error.response?.data?.fieldErrors?.[0]?.message ??
          error.message
        );
      }

      if (error instanceof Error) {
        return error.message;
      }

      return fallback;
    },
    getApiErrorStatus(error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        return error.response?.status ?? null;
      }

      return null;
    },
    async login(payload: LoginPayload) {
      const previousCookieToken = resolveCookieCsrfToken();
      const { data } = await rawClient.post<AuthResponse>('/auth/login', payload);
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async register(payload: RegisterPayload) {
      const previousCookieToken = resolveCookieCsrfToken();
      const { data } = await rawClient.post<AuthResponse>('/auth/register', payload);
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async logout(refreshToken?: string) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      await rawClient.post('/auth/logout', refreshToken ? { refreshToken } : {}, buildCookieWriteConfig());
      await stabilizeCookieCsrfToken(previousCookieToken);
    },
    async refreshAuth(payload: RefreshTokenPayload = {}) {
      const previousCookieToken = resolveCookieCsrfToken();
      const { data } = await rawClient.post<AuthResponse>('/auth/refresh', payload);
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async getSession() {
      const { data } = await rawClient.get<SessionResponse>('/auth/session');
      return data;
    },
    async requestPasswordReset(payload: RequestPasswordResetPayload) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      await rawClient.post('/auth/password-reset/request', payload, buildCookieWriteConfig());
      await stabilizeCookieCsrfToken(previousCookieToken);
    },
    async resetPassword(payload: ResetPasswordPayload) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      await rawClient.post('/auth/password-reset/confirm', payload, buildCookieWriteConfig());
      await stabilizeCookieCsrfToken(previousCookieToken);
    },
    async confirmEmailVerification(payload: ConfirmEmailVerificationPayload) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await rawClient.post<EmailVerificationResult>(
        '/auth/email-verification/confirm',
        payload,
        buildCookieWriteConfig()
      );
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async initializeCsrf() {
      const previousCookieToken = resolveCookieCsrfToken();
      await rawClient.get('/auth/csrf');
      if (authTransport === 'cookie') {
        latestCookieCsrfToken = await waitForCookieCsrfToken(previousCookieToken);
      }
    },
    async getHomeMarket() {
      const { data } = await apiClient.get<HomeMarketResponse>('/market/home');
      return data;
    },
    async searchStocks(query: string) {
      const { data } = await apiClient.get<StockSearchResponse>('/market/search', {
        params: { q: query },
      });
      return data;
    },
    async getStockDetail(symbol: string) {
      const { data } = await apiClient.get<Quote>(`/market/stocks/${symbol}`);
      return data;
    },
    async getStockHistory(symbol: string, range: StockHistoryRange) {
      const { data } = await apiClient.get<StockPriceHistory>(`/market/stocks/${symbol}/history`, {
        params: { range },
      });
      return data;
    },
    async getWatchlist() {
      const { data } = await apiClient.get<WatchlistResponse>('/watchlist');
      return data;
    },
    async addWatchlistItem(symbol: string, companyName?: string) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await apiClient.post<WatchlistItem>('/watchlist', {
        symbol,
        companyName,
      }, buildCookieWriteConfig());
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async removeWatchlistItem(symbol: string) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      await apiClient.delete(`/watchlist/${symbol}`, buildCookieWriteConfig());
      await stabilizeCookieCsrfToken(previousCookieToken);
    },
    async getPortfolio() {
      const { data } = await apiClient.get<PortfolioResponse>('/portfolio');
      return data;
    },
    async getPortfolioHistory(range: PortfolioHistoryRange) {
      const { data } = await apiClient.get<PortfolioHistoryResponse>('/portfolio/history', {
        params: { range },
      });
      return data;
    },
    async getNotifications() {
      const { data } = await apiClient.get<NotificationListResponse>('/notifications');
      return data;
    },
    async markNotificationRead(notificationId: string) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await apiClient.post<NotificationListResponse['notifications'][number]>(
        `/notifications/${notificationId}/read`,
        {},
        buildCookieWriteConfig()
      );
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async markAllNotificationsRead() {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      await apiClient.post('/notifications/read-all', {}, buildCookieWriteConfig());
      await stabilizeCookieCsrfToken(previousCookieToken);
    },
    async getAccountProfile() {
      const { data } = await apiClient.get<AccountProfile>('/account');
      return data;
    },
    async getSupportUsers(query?: string) {
      const { data } = await apiClient.get<SupportUserListResponse>('/admin/support/users', {
        params: query ? { query } : undefined,
      });
      return data;
    },
    async getSupportUserDetail(userId: string) {
      const { data } = await apiClient.get<SupportUserDetailResponse>(`/admin/support/users/${userId}`);
      return data;
    },
    async getAdminAnalyticsOverview(days: ProductAnalyticsWindowDays) {
      const { data } = await apiClient.get<ProductAnalyticsOverviewResponse>('/admin/analytics/overview', {
        params: { days },
      });
      return data;
    },
    async trackProductAnalyticsEvent(payload: TrackProductAnalyticsEventPayload) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      await apiClient.post('/analytics/events', payload, buildCookieWriteConfig());
      await stabilizeCookieCsrfToken(previousCookieToken);
    },
    async changePassword(payload: ChangePasswordPayload) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await apiClient.post<AuthResponse>(
        '/account/change-password',
        payload,
        buildCookieWriteConfig()
      );
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async requestEmailVerification() {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      await apiClient.post('/account/email-verification', {}, buildCookieWriteConfig());
      await stabilizeCookieCsrfToken(previousCookieToken);
    },
    async deleteAccount(payload: DeleteAccountPayload) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const config = buildCookieWriteConfig();
      await apiClient.delete('/account', {
        ...(config?.headers ? { headers: config.headers } : {}),
        data: payload,
      });
      await stabilizeCookieCsrfToken(previousCookieToken);
    },
    async getTradeHistory() {
      const { data } = await apiClient.get<TradeHistoryResponse>('/trades/history');
      return data;
    },
    async getOrders() {
      const { data } = await apiClient.get<OrderListResponse>('/orders');
      return data;
    },
    async getOrder(orderId: string) {
      const { data } = await apiClient.get<OrderDetailResponse>(`/orders/${orderId}`);
      return data;
    },
    async createOrder(payload: CreateOrderPayload, idempotencyKey: string) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await apiClient.post<Order>(
        '/orders',
        payload,
        buildCookieWriteConfig({
          'X-Idempotency-Key': idempotencyKey,
        })
      );
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async cancelOrder(orderId: string) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await apiClient.post<Order>(
        `/orders/${orderId}/cancel`,
        {},
        buildCookieWriteConfig()
      );
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async createConditionalOrder(payload: CreateConditionalOrderPayload) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await apiClient.post<ConditionalOrderResponse>(
        '/conditional-orders',
        payload,
        buildCookieWriteConfig()
      );
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async getConditionalOrders() {
      const { data } = await apiClient.get<ConditionalOrderListResponse>('/conditional-orders');
      return data;
    },
    async getConditionalOrder(orderId: string) {
      const { data } = await apiClient.get<ConditionalOrderDetailResponse>(`/conditional-orders/${orderId}`);
      return data;
    },
    async cancelConditionalOrder(orderId: string) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await apiClient.post<ConditionalOrderResponse>(
        `/conditional-orders/${orderId}/cancel`,
        {},
        buildCookieWriteConfig()
      );
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async buyStock(payload: TradeOrderPayload, idempotencyKey: string) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await apiClient.post<TradeExecutionResponse>(
        '/trades/buy',
        payload,
        buildCookieWriteConfig({
          'X-Idempotency-Key': idempotencyKey,
        })
      );
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
    async sellStock(payload: TradeOrderPayload, idempotencyKey: string) {
      const previousCookieToken = resolveCookieCsrfToken();
      await ensureCookieCsrfToken();
      const { data } = await apiClient.post<TradeExecutionResponse>(
        '/trades/sell',
        payload,
        buildCookieWriteConfig({
          'X-Idempotency-Key': idempotencyKey,
        })
      );
      await stabilizeCookieCsrfToken(previousCookieToken);
      return data;
    },
  };

  function buildCookieWriteConfig(headers?: Record<string, string>) {
    if (authTransport !== 'cookie') {
      return headers ? { headers } : undefined;
    }

    const csrfToken = resolveCookieCsrfToken();
    const mergedHeaders = {
      ...(headers ?? {}),
      ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
    };

    return Object.keys(mergedHeaders).length ? { headers: mergedHeaders } : undefined;
  }

  function resolveCookieCsrfToken() {
    if (authTransport !== 'cookie') {
      return null;
    }

    const cookieToken = readCookie('XSRF-TOKEN');
    if (cookieToken) {
      latestCookieCsrfToken = cookieToken;
      return cookieToken;
    }

    return latestCookieCsrfToken;
  }

  async function stabilizeCookieCsrfToken(previousToken?: string | null) {
    if (authTransport !== 'cookie') {
      return;
    }

    latestCookieCsrfToken = await waitForCookieCsrfToken(previousToken);

    if (readCookie('XSRF-TOKEN')) {
      latestCookieCsrfToken = readCookie('XSRF-TOKEN');
      return;
    }

    await rawClient.get('/auth/csrf');
    latestCookieCsrfToken = await waitForCookieCsrfToken(null);
  }

  async function ensureCookieCsrfToken() {
    if (authTransport !== 'cookie') {
      return null;
    }

    const existingToken = resolveCookieCsrfToken();
    if (existingToken) {
      return existingToken;
    }

    await rawClient.get('/auth/csrf');
    latestCookieCsrfToken = await waitForCookieCsrfToken(null);
    return latestCookieCsrfToken;
  }
}

function readCookie(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const target = `${name}=`;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(target));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(target.length));
}

async function waitForCookieCsrfToken(previousToken?: string | null) {
  const immediate = readCookie('XSRF-TOKEN');
  if (immediate && (!previousToken || immediate !== previousToken)) {
    return immediate;
  }

  let lastSeenToken = immediate ?? previousToken ?? null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    const nextToken = readCookie('XSRF-TOKEN');
    if (nextToken && (!previousToken || nextToken !== previousToken)) {
      return nextToken;
    }
    if (nextToken) {
      lastSeenToken = nextToken;
    }
  }

  return lastSeenToken;
}

function getHeader(config: RequestConfig, headerName: string) {
  const headers = config.headers as RequestConfig['headers'] & {
    get?: (name: string) => string | undefined;
  };

  if (typeof headers?.get === 'function') {
    return headers.get(headerName);
  }

  return headers?.[headerName as keyof typeof headers] as string | undefined;
}

function setHeader(config: RequestConfig, headerName: string, value: string) {
  const headers = config.headers as RequestConfig['headers'] & {
    set?: (name: string, value: string) => void;
  };

  if (typeof headers?.set === 'function') {
    headers.set(headerName, value);
    return;
  }

  headers[headerName as keyof typeof headers] = value as never;
}

function createClient(
  baseUrl: string,
  timeoutMs: number,
  authTransport: 'bearer' | 'cookie'
): AxiosInstance {
  return axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    withCredentials: authTransport === 'cookie',
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    withXSRFToken: authTransport === 'cookie',
  });
}

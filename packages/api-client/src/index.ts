import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import type {
  ApiErrorResponse,
  AuthResponse,
  HomeMarketResponse,
  ConditionalOrderDetailResponse,
  ConditionalOrderListResponse,
  ConditionalOrderResponse,
  CreateConditionalOrderPayload,
  LoginPayload,
  PortfolioResponse,
  Quote,
  RefreshTokenPayload,
  RegisterPayload,
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

  const rawClient = createClient(baseUrl, timeoutMs, authTransport);
  const apiClient = createClient(baseUrl, timeoutMs, authTransport);

  apiClient.interceptors.request.use((config) => {
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
      const { data } = await rawClient.post<AuthResponse>('/auth/login', payload);
      return data;
    },
    async register(payload: RegisterPayload) {
      const { data } = await rawClient.post<AuthResponse>('/auth/register', payload);
      return data;
    },
    async logout(refreshToken?: string) {
      await rawClient.post('/auth/logout', refreshToken ? { refreshToken } : {});
    },
    async refreshAuth(payload: RefreshTokenPayload = {}) {
      const { data } = await rawClient.post<AuthResponse>('/auth/refresh', payload);
      return data;
    },
    async getSession() {
      const { data } = await rawClient.get<SessionResponse>('/auth/session');
      return data;
    },
    async initializeCsrf() {
      await rawClient.get('/auth/csrf');
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
      const { data } = await apiClient.post<WatchlistItem>('/watchlist', {
        symbol,
        companyName,
      });
      return data;
    },
    async removeWatchlistItem(symbol: string) {
      await apiClient.delete(`/watchlist/${symbol}`);
    },
    async getPortfolio() {
      const { data } = await apiClient.get<PortfolioResponse>('/portfolio');
      return data;
    },
    async getTradeHistory() {
      const { data } = await apiClient.get<TradeHistoryResponse>('/trades/history');
      return data;
    },
    async createConditionalOrder(payload: CreateConditionalOrderPayload) {
      const { data } = await apiClient.post<ConditionalOrderResponse>('/conditional-orders', payload);
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
      const { data } = await apiClient.post<ConditionalOrderResponse>(`/conditional-orders/${orderId}/cancel`);
      return data;
    },
    async buyStock(payload: TradeOrderPayload, idempotencyKey: string) {
      const { data } = await apiClient.post<TradeExecutionResponse>('/trades/buy', payload, {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
      });
      return data;
    },
    async sellStock(payload: TradeOrderPayload, idempotencyKey: string) {
      const { data } = await apiClient.post<TradeExecutionResponse>('/trades/sell', payload, {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
      });
      return data;
    },
  };
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

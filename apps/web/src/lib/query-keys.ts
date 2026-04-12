export const queryKeys = {
  home: ['home-market'] as const,
  portfolio: ['portfolio'] as const,
  stockSearch: (query: string) => ['stock-search', query] as const,
  stockDetail: (symbol: string) => ['stock-detail', symbol] as const,
  stockHistory: (symbol: string, range: string) => ['stock-history', symbol, range] as const,
  watchlist: ['watchlist'] as const,
  tradeHistory: ['trade-history'] as const,
  conditionalOrders: ['conditional-orders'] as const,
  conditionalOrder: (orderId: string) => ['conditional-order', orderId] as const,
};

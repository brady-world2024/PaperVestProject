export const queryKeys = {
  home: ['home-market'] as const,
  stockDetail: (symbol: string) => ['stock-detail', symbol] as const,
  stockHistory: (symbol: string, range: string) => ['stock-history', symbol, range] as const,
  stockSearch: (query: string) => ['stock-search', query] as const,
  watchlist: ['watchlist'] as const,
  portfolio: ['portfolio'] as const,
  tradeHistory: ['trade-history'] as const,
  conditionalOrders: ['conditional-orders'] as const,
};

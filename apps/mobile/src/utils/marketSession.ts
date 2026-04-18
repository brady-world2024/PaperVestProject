import {
  getMarketSessionPresentation,
  type MarketSessionPresentation,
  type MarketSessionState,
} from '@papervest/shared-types';

export function describeMarketSession(session: MarketSessionState): MarketSessionPresentation {
  return getMarketSessionPresentation(session);
}

export function getMarketSessionTone(session: MarketSessionState) {
  switch (session) {
    case 'OPEN':
      return 'open' as const;
    case 'PRE_MARKET':
    case 'AFTER_HOURS':
      return 'extended' as const;
    case 'CLOSED':
    default:
      return 'closed' as const;
  }
}

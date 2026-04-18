import {
  getMarketSessionPresentation,
  type MarketSessionPresentation,
  type MarketSessionState,
} from '@papervest/shared-types';

export function describeMarketSession(session: MarketSessionState): MarketSessionPresentation {
  return getMarketSessionPresentation(session);
}

export function getMarketSessionChipClass(session: MarketSessionState) {
  switch (session) {
    case 'OPEN':
      return 'session-open';
    case 'PRE_MARKET':
    case 'AFTER_HOURS':
      return 'session-extended';
    case 'CLOSED':
    default:
      return 'session-closed';
  }
}

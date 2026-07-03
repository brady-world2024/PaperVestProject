import type { Holding, PortfolioSummary } from '@papervest/shared-types';

export type TradeAvailability = {
  cashBalance: number;
  reservedCashBalance: number;
  availableCashBalance: number;
  holdingQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

export function getTradeAvailability(
  summary: PortfolioSummary | null | undefined,
  holding: Holding | null | undefined
): TradeAvailability {
  return {
    cashBalance: summary?.cashBalance ?? 0,
    reservedCashBalance: summary?.reservedCashBalance ?? 0,
    availableCashBalance: summary?.availableCashBalance ?? 0,
    holdingQuantity: holding?.quantity ?? 0,
    reservedQuantity: holding?.reservedQuantity ?? 0,
    availableQuantity: holding?.availableQuantity ?? 0,
  };
}

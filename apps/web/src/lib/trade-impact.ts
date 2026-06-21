export type TradeSide = 'BUY' | 'SELL';

export type TradeImpactInput = {
  side: TradeSide;
  quantity: number;
  currentPrice: number;
  cashBalance: number;
  totalPortfolioValue: number;
  holdingQuantity: number;
  holdingAverageCost: number;
  holdingMarketValue: number;
};

export type TradeImpactInsightKind =
  | 'opening-position'
  | 'averaging-in'
  | 'position-concentration'
  | 'cash-cushion'
  | 'full-exit'
  | 'realize-gain'
  | 'realize-loss';

export type TradeImpactInsight = {
  kind: TradeImpactInsightKind;
  headline: string;
  copy: string;
};

export type TradeImpactPreview = {
  estimatedNotional: number;
  estimatedCashAfter: number;
  estimatedSharesAfter: number;
  estimatedPositionValueAfter: number;
  estimatedPortfolioValueAfter: number;
  estimatedPositionWeightAfter: number;
  estimatedCashWeightAfter: number;
  estimatedAverageCostAfter: number | null;
  estimatedRealizedPnl: number | null;
  insight: TradeImpactInsight | null;
};

export type TradeQuantityPreset = {
  label: string;
  quantity: number;
};

export function getTradeImpactPreview({
  side,
  quantity,
  currentPrice,
  cashBalance,
  totalPortfolioValue,
  holdingQuantity,
  holdingAverageCost,
  holdingMarketValue,
}: TradeImpactInput): TradeImpactPreview {
  const normalizedQuantity = clampQuantity(quantity);
  const estimatedNotional = normalizedQuantity * currentPrice;
  const otherHoldingsValue = Math.max(totalPortfolioValue - cashBalance - holdingMarketValue, 0);

  const estimatedCashAfter =
    side === 'BUY' ? cashBalance - estimatedNotional : cashBalance + estimatedNotional;
  const estimatedSharesAfter =
    side === 'BUY'
      ? holdingQuantity + normalizedQuantity
      : Math.max(holdingQuantity - normalizedQuantity, 0);
  const estimatedPositionValueAfter = estimatedSharesAfter * currentPrice;
  const estimatedPortfolioValueAfter =
    otherHoldingsValue + estimatedCashAfter + estimatedPositionValueAfter;
  const estimatedPositionWeightAfter =
    estimatedPortfolioValueAfter > 0
      ? (estimatedPositionValueAfter / estimatedPortfolioValueAfter) * 100
      : 0;
  const estimatedCashWeightAfter =
    estimatedPortfolioValueAfter > 0 ? (estimatedCashAfter / estimatedPortfolioValueAfter) * 100 : 0;

  const estimatedAverageCostAfter =
    side === 'BUY'
      ? estimatedSharesAfter > 0
        ? ((holdingQuantity * holdingAverageCost) + estimatedNotional) / estimatedSharesAfter
        : null
      : estimatedSharesAfter > 0
        ? holdingAverageCost
        : null;
  const estimatedRealizedPnl =
    side === 'SELL' ? (currentPrice - holdingAverageCost) * normalizedQuantity : null;

  return {
    estimatedNotional,
    estimatedCashAfter,
    estimatedSharesAfter,
    estimatedPositionValueAfter,
    estimatedPortfolioValueAfter,
    estimatedPositionWeightAfter,
    estimatedCashWeightAfter,
    estimatedAverageCostAfter,
    estimatedRealizedPnl,
    insight: getTradeImpactInsight({
      side,
      quantity: normalizedQuantity,
      estimatedCashAfter,
      estimatedCashWeightAfter,
      estimatedPositionWeightAfter,
      estimatedRealizedPnl,
      estimatedSharesAfter,
      holdingQuantity,
      estimatedAverageCostAfter,
    }),
  };
}

export function getTradeQuantityPresets({
  side,
  currentPrice,
  cashBalance,
  holdingQuantity,
}: {
  side: TradeSide;
  currentPrice: number;
  cashBalance: number;
  holdingQuantity: number;
}): TradeQuantityPreset[] {
  if (side === 'BUY') {
    const maxAffordable = currentPrice > 0 ? floorQuantity(cashBalance / currentPrice) : 0;
    const quarterCash = currentPrice > 0 ? floorQuantity((cashBalance * 0.25) / currentPrice) : 0;
    const halfCash = currentPrice > 0 ? floorQuantity((cashBalance * 0.5) / currentPrice) : 0;

    return dedupePresets([
      { label: '1 share', quantity: 1 },
      { label: '5 shares', quantity: 5 },
      { label: '25% cash', quantity: quarterCash },
      { label: '50% cash', quantity: halfCash },
      { label: 'Max', quantity: maxAffordable },
    ]);
  }

  return dedupePresets([
    { label: '25%', quantity: floorQuantity(holdingQuantity * 0.25) },
    { label: '50%', quantity: floorQuantity(holdingQuantity * 0.5) },
    { label: 'All out', quantity: floorQuantity(holdingQuantity) },
  ]);
}

function getTradeImpactInsight({
  side,
  quantity,
  estimatedCashAfter,
  estimatedCashWeightAfter,
  estimatedPositionWeightAfter,
  estimatedRealizedPnl,
  estimatedSharesAfter,
  holdingQuantity,
  estimatedAverageCostAfter,
}: {
  side: TradeSide;
  quantity: number;
  estimatedCashAfter: number;
  estimatedCashWeightAfter: number;
  estimatedPositionWeightAfter: number;
  estimatedRealizedPnl: number | null;
  estimatedSharesAfter: number;
  holdingQuantity: number;
  estimatedAverageCostAfter: number | null;
}): TradeImpactInsight | null {
  if (quantity <= 0) {
    return null;
  }

  if (side === 'BUY') {
    if (holdingQuantity <= 0) {
      return {
        kind: 'opening-position',
        headline: 'Opening a new position',
        copy: `This order starts a new line item and uses the current quote as the first cost basis anchor.`,
      };
    }

    if (estimatedPositionWeightAfter >= 35) {
      return {
        kind: 'position-concentration',
        headline: 'Position concentration increases',
        copy: `This name would rise to about ${formatImpactPercent(estimatedPositionWeightAfter)} of your portfolio value.`,
      };
    }

    if (estimatedCashWeightAfter <= 15 || estimatedCashAfter <= 0) {
      return {
        kind: 'cash-cushion',
        headline: 'Cash cushion gets tighter',
        copy: `You would keep about ${formatImpactPercent(Math.max(estimatedCashWeightAfter, 0))} of the account in cash after this order.`,
      };
    }

    return {
      kind: 'averaging-in',
      headline: 'Averaging into the position',
      copy: `Projected average cost moves toward ${estimatedAverageCostAfter == null ? '$0.00' : '$' + estimatedAverageCostAfter.toFixed(2)} if the order fills at this mark.`,
    };
  }

  if (estimatedSharesAfter <= 0 && holdingQuantity > 0) {
    return {
      kind: 'full-exit',
      headline: 'This exits the position',
      copy: 'The order would flatten the position and move its market value back into cash at the current quote.',
    };
  }

  if ((estimatedRealizedPnl ?? 0) >= 0) {
    return {
      kind: 'realize-gain',
      headline: 'This locks in gains',
      copy: `At the current quote, the realized component stays positive while leaving ${formatImpactPercent(estimatedPositionWeightAfter)} of the portfolio in this name.`,
    };
  }

  return {
    kind: 'realize-loss',
    headline: 'This realizes a loss',
    copy: `At the current quote, the sale realizes a loss and reduces the position to ${formatImpactPercent(estimatedPositionWeightAfter)} of portfolio value.`,
  };
}

function dedupePresets(presets: TradeQuantityPreset[]) {
  const seen = new Set<string>();

  return presets.filter((preset) => {
    if (preset.quantity <= 0) {
      return false;
    }

    const key = preset.quantity.toFixed(4);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function floorQuantity(value: number) {
  return Math.floor(Math.max(value, 0) * 10_000) / 10_000;
}

function clampQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

function formatImpactPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

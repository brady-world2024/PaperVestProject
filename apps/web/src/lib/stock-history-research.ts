import type { StockPriceBar } from '@papervest/shared-types';

export type ResearchSeriesPoint = StockPriceBar & {
  movingAverage5: number | null;
  movingAverage20: number | null;
  vwap: number | null;
};

export type FiftyTwoWeekContext = {
  high: number;
  low: number;
  currentPrice: number;
  rangePositionPercent: number;
  distanceFromHighPercent: number;
};

export function buildResearchSeries(points: StockPriceBar[]) {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  return points.map((point, index) => {
    const typicalPrice = (point.highPrice + point.lowPrice + point.closePrice) / 3;
    cumulativePriceVolume += typicalPrice * point.volume;
    cumulativeVolume += point.volume;

    return {
      ...point,
      movingAverage5: calculateMovingAverage(points, index, 5),
      movingAverage20: calculateMovingAverage(points, index, 20),
      vwap: cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : null,
    } satisfies ResearchSeriesPoint;
  });
}

export function getAverageVolume(points: StockPriceBar[]) {
  if (!points.length) {
    return 0;
  }

  return points.reduce((sum, point) => sum + point.volume, 0) / points.length;
}

export function getFiftyTwoWeekContext(points: StockPriceBar[], currentPrice: number): FiftyTwoWeekContext | null {
  if (!points.length) {
    return null;
  }

  const high = Math.max(...points.map((point) => point.highPrice));
  const low = Math.min(...points.map((point) => point.lowPrice));
  const spread = high - low;

  return {
    high,
    low,
    currentPrice,
    rangePositionPercent: spread > 0 ? ((currentPrice - low) / spread) * 100 : 100,
    distanceFromHighPercent: high > 0 ? ((high - currentPrice) / high) * 100 : 0,
  };
}

function calculateMovingAverage(points: StockPriceBar[], index: number, period: number) {
  if (index + 1 < period) {
    return null;
  }

  const window = points.slice(index - period + 1, index + 1);
  const total = window.reduce((sum, point) => sum + point.closePrice, 0);
  return total / period;
}

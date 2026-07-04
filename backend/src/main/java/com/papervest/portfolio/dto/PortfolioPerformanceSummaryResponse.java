package com.papervest.portfolio.dto;

import java.math.BigDecimal;

public record PortfolioPerformanceSummaryResponse(
		BigDecimal currentValue,
		BigDecimal startValue,
		BigDecimal endValue,
		BigDecimal absoluteReturn,
		BigDecimal returnPercent,
		BigDecimal periodReturnPercent,
		BigDecimal timeWeightedReturnPercent,
		BigDecimal moneyWeightedReturnPercent,
		BigDecimal netCashFlow,
		BigDecimal maxDrawdownPercent,
		BigDecimal realizedPnl,
		BigDecimal unrealizedPnl
) {
}

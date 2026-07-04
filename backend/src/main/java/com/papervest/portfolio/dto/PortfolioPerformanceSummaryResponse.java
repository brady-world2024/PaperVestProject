package com.papervest.portfolio.dto;

import java.math.BigDecimal;

public record PortfolioPerformanceSummaryResponse(
		BigDecimal currentValue,
		BigDecimal startValue,
		BigDecimal endValue,
		BigDecimal absoluteReturn,
		BigDecimal returnPercent,
		BigDecimal maxDrawdownPercent,
		BigDecimal realizedPnl,
		BigDecimal unrealizedPnl
) {
}

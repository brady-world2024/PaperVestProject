package com.papervest.portfolio.dto;

import java.math.BigDecimal;

public record HoldingResponse(
		String symbol,
		String companyName,
		BigDecimal quantity,
		BigDecimal averageCost,
		BigDecimal currentPrice,
		BigDecimal costBasis,
		BigDecimal marketValue,
		BigDecimal unrealizedPnl,
		BigDecimal unrealizedPnlPercent,
		BigDecimal dailyChange,
		boolean staleQuote
) {
}

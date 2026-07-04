package com.papervest.portfolio.dto;

import java.math.BigDecimal;

public record PortfolioHoldingContributionResponse(
		int rank,
		String symbol,
		String companyName,
		BigDecimal marketValue,
		BigDecimal portfolioWeightPercent,
		BigDecimal unrealizedPnl,
		BigDecimal unrealizedPnlPercent
) {
}

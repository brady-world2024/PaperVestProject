package com.papervest.portfolio.dto;

import java.math.BigDecimal;

public record PortfolioPnlContributionResponse(
		BigDecimal realizedValue,
		BigDecimal realizedPercent,
		BigDecimal unrealizedValue,
		BigDecimal unrealizedPercent
) {
}

package com.papervest.portfolio.dto;

import java.math.BigDecimal;

public record PortfolioAllocationResponse(
		BigDecimal cashValue,
		BigDecimal cashPercent,
		BigDecimal holdingsValue,
		BigDecimal holdingsPercent
) {
}

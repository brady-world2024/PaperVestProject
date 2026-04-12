package com.papervest.portfolio.dto;

import java.util.List;

public record PortfolioResponse(
		PortfolioSummaryResponse summary,
		List<HoldingResponse> holdings
) {
}

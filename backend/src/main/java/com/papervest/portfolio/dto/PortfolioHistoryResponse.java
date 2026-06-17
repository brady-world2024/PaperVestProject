package com.papervest.portfolio.dto;

import com.papervest.portfolio.model.PortfolioHistoryRange;

import java.time.Instant;
import java.util.List;

public record PortfolioHistoryResponse(
		PortfolioHistoryRange range,
		Instant from,
		Instant to,
		List<PortfolioHistoryPointResponse> points
) {
}

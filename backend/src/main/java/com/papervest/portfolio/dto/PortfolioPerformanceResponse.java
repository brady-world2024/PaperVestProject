package com.papervest.portfolio.dto;

import com.papervest.portfolio.model.PortfolioPerformanceRange;
import com.papervest.portfolio.model.PortfolioPerformanceStatus;

import java.time.Instant;
import java.util.List;

public record PortfolioPerformanceResponse(
		PortfolioPerformanceRange range,
		Instant from,
		Instant to,
		PortfolioPerformanceStatus status,
		PortfolioPerformanceSummaryResponse summary,
		PortfolioAllocationResponse allocation,
		PortfolioPnlContributionResponse pnlContribution,
		List<PortfolioHoldingContributionResponse> topHoldings,
		List<PortfolioPerformancePointResponse> points
) {
}

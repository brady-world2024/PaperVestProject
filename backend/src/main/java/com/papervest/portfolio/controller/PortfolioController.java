package com.papervest.portfolio.controller;

import com.papervest.common.security.AuthenticatedUser;
import com.papervest.portfolio.dto.PortfolioHistoryResponse;
import com.papervest.portfolio.dto.PortfolioResponse;
import com.papervest.portfolio.model.PortfolioHistoryRange;
import com.papervest.portfolio.service.PortfolioHistoryService;
import com.papervest.portfolio.service.PortfolioQueryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/portfolio")
public class PortfolioController {

	private final PortfolioQueryService portfolioQueryService;
	private final PortfolioHistoryService portfolioHistoryService;

	public PortfolioController(
			PortfolioQueryService portfolioQueryService,
			PortfolioHistoryService portfolioHistoryService
	) {
		this.portfolioQueryService = portfolioQueryService;
		this.portfolioHistoryService = portfolioHistoryService;
	}

	@GetMapping
	public PortfolioResponse getPortfolio(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return portfolioQueryService.getPortfolio(currentUser.userId());
	}

	@GetMapping("/history")
	public PortfolioHistoryResponse getPortfolioHistory(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@RequestParam(defaultValue = "1M") String range
	) {
		return portfolioHistoryService.getHistory(currentUser.userId(), PortfolioHistoryRange.fromValue(range));
	}
}

package com.papervest.portfolio.controller;

import com.papervest.common.security.AuthenticatedUser;
import com.papervest.portfolio.dto.PortfolioResponse;
import com.papervest.portfolio.service.PortfolioQueryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/portfolio")
public class PortfolioController {

	private final PortfolioQueryService portfolioQueryService;

	public PortfolioController(PortfolioQueryService portfolioQueryService) {
		this.portfolioQueryService = portfolioQueryService;
	}

	@GetMapping
	public PortfolioResponse getPortfolio(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return portfolioQueryService.getPortfolio(currentUser.userId());
	}
}

package com.papervest.portfolio.service;

import com.papervest.portfolio.dto.PortfolioResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class PortfolioQueryService {

	private static final Logger log = LoggerFactory.getLogger(PortfolioQueryService.class);
	private final PortfolioValuationService portfolioValuationService;

	public PortfolioQueryService(PortfolioValuationService portfolioValuationService) {
		this.portfolioValuationService = portfolioValuationService;
	}

	@Transactional(readOnly = true)
	public PortfolioResponse getPortfolio(UUID userId) {
		PortfolioResponse response = portfolioValuationService.getPortfolio(userId);
		long staleHoldingCount = response.holdings().stream().filter(holding -> holding.staleQuote()).count();
		log.debug(
				"Portfolio loaded userId={} holdingCount={} staleHoldingCount={} totalValue={} unrealizedPnl={}",
				userId,
				response.holdings().size(),
				staleHoldingCount,
				response.summary().totalPortfolioValue(),
				response.summary().unrealizedPnl()
		);
		return response;
	}
}

package com.papervest.portfolio.service;

import com.papervest.portfolio.dto.PortfolioHistoryPointResponse;
import com.papervest.portfolio.dto.PortfolioHistoryResponse;
import com.papervest.portfolio.dto.PortfolioResponse;
import com.papervest.portfolio.model.PortfolioHistoryRange;
import com.papervest.portfolio.model.PortfolioSnapshot;
import com.papervest.portfolio.model.PortfolioSnapshotSource;
import com.papervest.portfolio.repository.PortfolioSnapshotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class PortfolioHistoryService {

	private static final Logger log = LoggerFactory.getLogger(PortfolioHistoryService.class);

	private final PortfolioSnapshotRepository portfolioSnapshotRepository;
	private final PortfolioValuationService portfolioValuationService;
	private final Clock clock;

	public PortfolioHistoryService(
			PortfolioSnapshotRepository portfolioSnapshotRepository,
			PortfolioValuationService portfolioValuationService,
			Clock clock
	) {
		this.portfolioSnapshotRepository = portfolioSnapshotRepository;
		this.portfolioValuationService = portfolioValuationService;
		this.clock = clock;
	}

	@Transactional
	public void recordTradeExecutionSnapshot(UUID userId, Instant capturedAt) {
		PortfolioResponse portfolio = portfolioValuationService.getPortfolio(userId);
		portfolioSnapshotRepository.save(new PortfolioSnapshot(
				userId,
				portfolio.summary().totalPortfolioValue(),
				portfolio.summary().cashBalance(),
				portfolio.summary().holdingsMarketValue(),
				portfolio.summary().realizedPnl(),
				portfolio.summary().unrealizedPnl(),
				PortfolioSnapshotSource.TRADE_EXECUTION,
				capturedAt
		));
		log.info(
				"Portfolio snapshot recorded userId={} source={} capturedAt={} totalValue={}",
				userId,
				PortfolioSnapshotSource.TRADE_EXECUTION,
				capturedAt,
				portfolio.summary().totalPortfolioValue()
		);
	}

	@Transactional(readOnly = true)
	public PortfolioHistoryResponse getHistory(UUID userId, PortfolioHistoryRange range) {
		Instant to = clock.instant();
		Instant from = range.since(clock);
		List<PortfolioSnapshot> snapshots = from == null
				? portfolioSnapshotRepository.findByUserIdOrderByCreatedAtAsc(userId)
				: portfolioSnapshotRepository.findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(userId, from);

		return new PortfolioHistoryResponse(
				range,
				from,
				to,
				snapshots.stream()
						.map(snapshot -> new PortfolioHistoryPointResponse(
								snapshot.getCreatedAt(),
								snapshot.getTotalPortfolioValue(),
								snapshot.getCashBalance(),
								snapshot.getHoldingsMarketValue(),
								snapshot.getRealizedPnl(),
								snapshot.getUnrealizedPnl(),
								snapshot.getSnapshotSource().name()
						))
						.toList()
		);
	}
}

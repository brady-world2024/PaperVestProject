package com.papervest.portfolio.service;

import com.papervest.portfolio.dto.HoldingResponse;
import com.papervest.portfolio.dto.PortfolioResponse;
import com.papervest.portfolio.dto.PortfolioSummaryResponse;
import com.papervest.portfolio.model.DailyPerformanceSnapshot;
import com.papervest.portfolio.model.PortfolioPerformanceRange;
import com.papervest.portfolio.model.PortfolioPerformanceStatus;
import com.papervest.portfolio.model.PortfolioSnapshot;
import com.papervest.portfolio.model.PortfolioSnapshotSource;
import com.papervest.portfolio.repository.DailyPerformanceSnapshotRepository;
import com.papervest.portfolio.repository.PortfolioSnapshotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioPerformanceServiceTest {

	private static final Instant NOW = Instant.parse("2026-07-05T12:00:00Z");

	@Mock
	private PortfolioSnapshotRepository portfolioSnapshotRepository;

	@Mock
	private DailyPerformanceSnapshotRepository dailyPerformanceSnapshotRepository;

	@Mock
	private PortfolioValuationService portfolioValuationService;

	private PortfolioPerformanceService portfolioPerformanceService;

	@BeforeEach
	void setUp() {
		portfolioPerformanceService = new PortfolioPerformanceService(
				portfolioSnapshotRepository,
				dailyPerformanceSnapshotRepository,
				portfolioValuationService,
				new PerformanceReturnCalculator(),
				Clock.fixed(NOW, ZoneOffset.UTC)
		);
	}

	@Test
	void usesDailySnapshotsForProfessionalReturnMetrics() {
		UUID userId = UUID.randomUUID();
		LocalDate today = LocalDate.parse("2026-07-05");
		when(dailyPerformanceSnapshotRepository.findByUserIdAndPerformanceDateLessThanEqualOrderByPerformanceDateAsc(
				userId,
				today
		)).thenReturn(List.of(
				dailySnapshot(userId, "2026-06-05", "100000.00", "20000.00", "80000.00", "1000.00", "2000.00", "0.00", "0.00", "0.00", null),
				dailySnapshot(userId, "2026-06-06", "110000.00", "22000.00", "88000.00", "1200.00", "8800.00", "0.00", "10.00", "10.00", "10.00"),
				dailySnapshot(userId, "2026-06-07", "104500.00", "20900.00", "83600.00", "1500.00", "3000.00", "0.00", "-5.00", "4.50", "4.50")
		));
		when(portfolioValuationService.getPortfolio(userId)).thenReturn(portfolio(
				"106000.00",
				"21200.00",
				"84800.00",
				"2500.00",
				"3500.00",
				List.of(holding("AAPL", "Apple Inc.", "33920.00", "3500.00", "11.55"))
		));

		var response = portfolioPerformanceService.getPerformance(userId, PortfolioPerformanceRange.ONE_MONTH);

		assertThat(response.status()).isEqualTo(PortfolioPerformanceStatus.READY);
		assertThat(response.from()).isEqualTo(Instant.parse("2026-06-05T00:00:00Z"));
		assertThat(response.summary().currentValue()).isEqualByComparingTo("106000.00");
		assertThat(response.summary().startValue()).isEqualByComparingTo("100000.00");
		assertThat(response.summary().endValue()).isEqualByComparingTo("104500.00");
		assertThat(response.summary().absoluteReturn()).isEqualByComparingTo("4500.00");
		assertThat(response.summary().returnPercent()).isEqualByComparingTo("4.50");
		assertThat(response.summary().periodReturnPercent()).isEqualByComparingTo("-5.00");
		assertThat(response.summary().timeWeightedReturnPercent()).isEqualByComparingTo("4.50");
		assertThat(response.summary().moneyWeightedReturnPercent()).isEqualByComparingTo("4.50");
		assertThat(response.summary().netCashFlow()).isEqualByComparingTo("0.00");
		assertThat(response.points()).hasSize(3);
		assertThat(response.points().getLast().date()).isEqualTo(LocalDate.parse("2026-06-07"));
		assertThat(response.points().getLast().timeWeightedReturnPercent()).isEqualByComparingTo("4.50");
		assertThat(response.points().getLast().moneyWeightedReturnPercent()).isEqualByComparingTo("4.50");
	}

	@Test
	void calculatesReturnDrawdownAllocationContributionAndHoldingRanking() {
		UUID userId = UUID.randomUUID();
		Instant first = PortfolioPerformanceRange.ONE_MONTH.since(Clock.fixed(NOW, ZoneOffset.UTC));
		Instant second = NOW.minusSeconds(86_400 * 2);
		Instant third = NOW.minusSeconds(86_400);
		PortfolioSnapshot baseline = snapshot(userId, "100000.00", "20000.00", "80000.00", "1000.00", "2000.00", first);

		when(portfolioSnapshotRepository.findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
				userId,
				PortfolioPerformanceRange.ONE_MONTH.since(Clock.fixed(NOW, ZoneOffset.UTC))
		)).thenReturn(List.of(
				baseline,
				snapshot(userId, "96000.00", "22000.00", "74000.00", "800.00", "-3000.00", second),
				snapshot(userId, "104000.00", "21000.00", "83000.00", "2000.00", "5000.00", third)
		));
		when(portfolioSnapshotRepository.findFirstByUserIdAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
				userId,
				PortfolioPerformanceRange.ONE_MONTH.since(Clock.fixed(NOW, ZoneOffset.UTC))
		)).thenReturn(Optional.of(baseline));
		when(portfolioValuationService.getPortfolio(userId)).thenReturn(portfolio(
				"106000.00",
				"21200.00",
				"84800.00",
				"2500.00",
				"3500.00",
				List.of(
						holding("MSFT", "Microsoft Corporation", "50880.00", "2500.00", "5.18"),
						holding("AAPL", "Apple Inc.", "33920.00", "3500.00", "11.55")
				)
		));

		var response = portfolioPerformanceService.getPerformance(userId, PortfolioPerformanceRange.ONE_MONTH);

		assertThat(response.status()).isEqualTo(PortfolioPerformanceStatus.READY);
		assertThat(response.summary().currentValue()).isEqualByComparingTo("106000.00");
		assertThat(response.summary().startValue()).isEqualByComparingTo("100000.00");
		assertThat(response.summary().endValue()).isEqualByComparingTo("106000.00");
		assertThat(response.summary().absoluteReturn()).isEqualByComparingTo("6000.00");
		assertThat(response.summary().returnPercent()).isEqualByComparingTo("6.00");
		assertThat(response.summary().maxDrawdownPercent()).isEqualByComparingTo("4.00");
		assertThat(response.summary().realizedPnl()).isEqualByComparingTo("2500.00");
		assertThat(response.summary().unrealizedPnl()).isEqualByComparingTo("3500.00");
		assertThat(response.allocation().cashValue()).isEqualByComparingTo("21200.00");
		assertThat(response.allocation().cashPercent()).isEqualByComparingTo("20.00");
		assertThat(response.allocation().holdingsValue()).isEqualByComparingTo("84800.00");
		assertThat(response.allocation().holdingsPercent()).isEqualByComparingTo("80.00");
		assertThat(response.pnlContribution().realizedValue()).isEqualByComparingTo("2500.00");
		assertThat(response.pnlContribution().realizedPercent()).isEqualByComparingTo("41.67");
		assertThat(response.pnlContribution().unrealizedValue()).isEqualByComparingTo("3500.00");
		assertThat(response.pnlContribution().unrealizedPercent()).isEqualByComparingTo("58.33");
		assertThat(response.points()).hasSize(4);
		assertThat(response.points().get(1).drawdownPercent()).isEqualByComparingTo("4.00");
		assertThat(response.points().get(3).totalPortfolioValue()).isEqualByComparingTo("106000.00");
		assertThat(response.topHoldings()).hasSize(2);
		assertThat(response.topHoldings().get(0).rank()).isEqualTo(1);
		assertThat(response.topHoldings().get(0).symbol()).isEqualTo("AAPL");
		assertThat(response.topHoldings().get(0).portfolioWeightPercent()).isEqualByComparingTo("32.00");
		assertThat(response.topHoldings().get(1).rank()).isEqualTo(2);
	}

	@Test
	void sparseHistoryReturnsCurrentPointAndInsufficientHistory() {
		UUID userId = UUID.randomUUID();
		when(portfolioSnapshotRepository.findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
				userId,
				PortfolioPerformanceRange.ONE_MONTH.since(Clock.fixed(NOW, ZoneOffset.UTC))
		)).thenReturn(List.of());
		when(portfolioSnapshotRepository.findFirstByUserIdAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
				userId,
				PortfolioPerformanceRange.ONE_MONTH.since(Clock.fixed(NOW, ZoneOffset.UTC))
		)).thenReturn(Optional.empty());
		when(portfolioValuationService.getPortfolio(userId)).thenReturn(portfolio(
				"100000.00",
				"100000.00",
				"0.00",
				"0.00",
				"0.00",
				List.of()
		));

		var response = portfolioPerformanceService.getPerformance(userId, PortfolioPerformanceRange.ONE_MONTH);

		assertThat(response.status()).isEqualTo(PortfolioPerformanceStatus.INSUFFICIENT_HISTORY);
		assertThat(response.from()).isNull();
		assertThat(response.to()).isEqualTo(NOW);
		assertThat(response.summary().currentValue()).isEqualByComparingTo("100000.00");
		assertThat(response.summary().startValue()).isEqualByComparingTo("100000.00");
		assertThat(response.summary().endValue()).isEqualByComparingTo("100000.00");
		assertThat(response.summary().absoluteReturn()).isEqualByComparingTo("0.00");
		assertThat(response.summary().returnPercent()).isEqualByComparingTo("0.00");
		assertThat(response.summary().maxDrawdownPercent()).isEqualByComparingTo("0.00");
		assertThat(response.points()).hasSize(1);
		assertThat(response.points().getFirst().timestamp()).isEqualTo(NOW);
		assertThat(response.points().getFirst().totalPortfolioValue()).isEqualByComparingTo("100000.00");
		assertThat(response.points().getFirst().drawdownPercent()).isEqualByComparingTo("0.00");
	}

	@Test
	void finiteRangeWithOnlyRecentSnapshotsReturnsInsufficientHistory() {
		UUID userId = UUID.randomUUID();
		Instant recent = NOW.minusSeconds(3_600);
		when(portfolioSnapshotRepository.findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
				userId,
				PortfolioPerformanceRange.ONE_MONTH.since(Clock.fixed(NOW, ZoneOffset.UTC))
		)).thenReturn(List.of(
				snapshot(userId, "100000.00", "20000.00", "80000.00", "0.00", "0.00", recent)
		));
		when(portfolioSnapshotRepository.findFirstByUserIdAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
				userId,
				PortfolioPerformanceRange.ONE_MONTH.since(Clock.fixed(NOW, ZoneOffset.UTC))
		)).thenReturn(Optional.empty());
		when(portfolioValuationService.getPortfolio(userId)).thenReturn(portfolio(
				"101000.00",
				"20200.00",
				"80800.00",
				"0.00",
				"1000.00",
				List.of(holding("AAPL", "Apple Inc.", "80800.00", "1000.00", "1.25"))
		));

		var response = portfolioPerformanceService.getPerformance(userId, PortfolioPerformanceRange.ONE_MONTH);

		assertThat(response.status()).isEqualTo(PortfolioPerformanceStatus.INSUFFICIENT_HISTORY);
		assertThat(response.from()).isEqualTo(recent);
		assertThat(response.summary().startValue()).isEqualByComparingTo("100000.00");
		assertThat(response.summary().absoluteReturn()).isEqualByComparingTo("1000.00");
		assertThat(response.summary().returnPercent()).isEqualByComparingTo("1.00");
		assertThat(response.points()).hasSize(2);
	}

	@Test
	void finiteRangeWithStaleBaselineReturnsInsufficientHistory() {
		UUID userId = UUID.randomUUID();
		Instant rangeStart = PortfolioPerformanceRange.ONE_MONTH.since(Clock.fixed(NOW, ZoneOffset.UTC));
		Instant staleBaselineTime = rangeStart.minusSeconds(86_400 * 10);
		Instant recent = NOW.minusSeconds(3_600);
		PortfolioSnapshot staleBaseline = snapshot(userId, "99000.00", "19000.00", "80000.00", "0.00", "-1000.00", staleBaselineTime);

		when(portfolioSnapshotRepository.findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
				userId,
				rangeStart
		)).thenReturn(List.of(
				snapshot(userId, "100000.00", "20000.00", "80000.00", "0.00", "0.00", recent)
		));
		when(portfolioSnapshotRepository.findFirstByUserIdAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
				userId,
				rangeStart
		)).thenReturn(Optional.of(staleBaseline));
		when(portfolioValuationService.getPortfolio(userId)).thenReturn(portfolio(
				"101000.00",
				"20200.00",
				"80800.00",
				"0.00",
				"1000.00",
				List.of(holding("AAPL", "Apple Inc.", "80800.00", "1000.00", "1.25"))
		));

		var response = portfolioPerformanceService.getPerformance(userId, PortfolioPerformanceRange.ONE_MONTH);

		assertThat(response.status()).isEqualTo(PortfolioPerformanceStatus.INSUFFICIENT_HISTORY);
		assertThat(response.from()).isEqualTo(staleBaselineTime);
		assertThat(response.summary().startValue()).isEqualByComparingTo("99000.00");
		assertThat(response.summary().absoluteReturn()).isEqualByComparingTo("2000.00");
	}

	private PortfolioSnapshot snapshot(
			UUID userId,
			String totalPortfolioValue,
			String cashBalance,
			String holdingsMarketValue,
			String realizedPnl,
			String unrealizedPnl,
			Instant capturedAt
	) {
		return new PortfolioSnapshot(
				userId,
				bd(totalPortfolioValue),
				bd(cashBalance),
				bd(holdingsMarketValue),
				bd(realizedPnl),
				bd(unrealizedPnl),
				PortfolioSnapshotSource.TRADE_EXECUTION,
				capturedAt
		);
	}

	private DailyPerformanceSnapshot dailySnapshot(
			UUID userId,
			String performanceDate,
			String totalPortfolioValue,
			String cashBalance,
			String holdingsMarketValue,
			String realizedPnl,
			String unrealizedPnl,
			String netCashFlow,
			String periodReturnPercent,
			String cumulativeTwrPercent,
			String cumulativeMwrPercent
	) {
		return new DailyPerformanceSnapshot(
				userId,
				LocalDate.parse(performanceDate),
				bd(totalPortfolioValue),
				bd(cashBalance),
				bd(holdingsMarketValue),
				bd(realizedPnl),
				bd(unrealizedPnl),
				bd(netCashFlow),
				bd(periodReturnPercent),
				bd(cumulativeTwrPercent),
				cumulativeMwrPercent == null ? null : bd(cumulativeMwrPercent)
		);
	}

	private PortfolioResponse portfolio(
			String totalPortfolioValue,
			String cashBalance,
			String holdingsMarketValue,
			String realizedPnl,
			String unrealizedPnl,
			List<HoldingResponse> holdings
	) {
		return new PortfolioResponse(
				new PortfolioSummaryResponse(
						bd("100000.00"),
						bd(cashBalance),
						bd("0.00"),
						bd(cashBalance),
						bd(holdingsMarketValue),
						bd(totalPortfolioValue),
						bd(unrealizedPnl),
						bd(realizedPnl),
						bd(realizedPnl).add(bd(unrealizedPnl)),
						bd("0.00"),
						bd("0.00")
				),
				holdings
		);
	}

	private HoldingResponse holding(
			String symbol,
			String companyName,
			String marketValue,
			String unrealizedPnl,
			String unrealizedPnlPercent
	) {
		return new HoldingResponse(
				symbol,
				companyName,
				bd("10.0000"),
				bd("0.0000"),
				bd("10.0000"),
				bd("100.0000"),
				bd("100.0000"),
				bd("1000.00"),
				bd(marketValue),
				bd(unrealizedPnl),
				bd(unrealizedPnlPercent),
				bd("0.00"),
				false,
				NOW,
				null,
				true,
				"America/New_York"
		);
	}

	private BigDecimal bd(String value) {
		return new BigDecimal(value);
	}
}

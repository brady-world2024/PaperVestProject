package com.papervest.portfolio.service;

import com.papervest.portfolio.dto.PortfolioResponse;
import com.papervest.portfolio.dto.PortfolioSummaryResponse;
import com.papervest.portfolio.model.DailyPerformanceSnapshot;
import com.papervest.portfolio.repository.DailyPerformanceSnapshotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyPerformanceSnapshotServiceTest {

	@Mock
	private DailyPerformanceSnapshotRepository dailyPerformanceSnapshotRepository;

	@Mock
	private PortfolioValuationService portfolioValuationService;

	private DailyPerformanceSnapshotService service;

	@BeforeEach
	void setUp() {
		service = new DailyPerformanceSnapshotService(
				dailyPerformanceSnapshotRepository,
				portfolioValuationService,
				new PerformanceReturnCalculator()
		);
	}

	@Test
	void createsDailySnapshotFromCurrentPortfolioValuation() {
		UUID userId = UUID.randomUUID();
		LocalDate performanceDate = LocalDate.parse("2026-07-05");
		when(portfolioValuationService.getPortfolio(userId)).thenReturn(portfolio(
				"100000.00",
				"80000.00",
				"20000.00",
				"1250.00",
				"750.00"
		));
		when(dailyPerformanceSnapshotRepository.findByUserIdAndPerformanceDateLessThanEqualOrderByPerformanceDateAsc(
				userId,
				performanceDate
		)).thenReturn(List.of());
		when(dailyPerformanceSnapshotRepository.findByUserIdAndPerformanceDate(userId, performanceDate))
				.thenReturn(Optional.empty());
		ArgumentCaptor<DailyPerformanceSnapshot> captor = ArgumentCaptor.forClass(DailyPerformanceSnapshot.class);
		when(dailyPerformanceSnapshotRepository.save(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

		DailyPerformanceSnapshot snapshot = service.recordDailySnapshot(userId, performanceDate);

		assertThat(snapshot).isSameAs(captor.getValue());
		assertThat(snapshot.getUserId()).isEqualTo(userId);
		assertThat(snapshot.getPerformanceDate()).isEqualTo(performanceDate);
		assertThat(snapshot.getTotalPortfolioValue()).isEqualByComparingTo("100000.00");
		assertThat(snapshot.getCashBalance()).isEqualByComparingTo("80000.00");
		assertThat(snapshot.getHoldingsMarketValue()).isEqualByComparingTo("20000.00");
		assertThat(snapshot.getRealizedPnl()).isEqualByComparingTo("1250.00");
		assertThat(snapshot.getUnrealizedPnl()).isEqualByComparingTo("750.00");
		assertThat(snapshot.getNetCashFlow()).isEqualByComparingTo("0.00");
		assertThat(snapshot.getPeriodReturnPercent()).isEqualByComparingTo("0.00");
		assertThat(snapshot.getCumulativeTwrPercent()).isEqualByComparingTo("0.00");
		assertThat(snapshot.getCumulativeMwrPercent()).isNull();
	}

	@Test
	void updatesExistingDailySnapshotInsteadOfCreatingDuplicate() {
		UUID userId = UUID.randomUUID();
		LocalDate performanceDate = LocalDate.parse("2026-07-05");
		DailyPerformanceSnapshot existing = snapshot(userId, performanceDate, "99000.00", "0.00", "0.00", null);
		when(portfolioValuationService.getPortfolio(userId)).thenReturn(portfolio(
				"101000.00",
				"81000.00",
				"20000.00",
				"1000.00",
				"1000.00"
		));
		when(dailyPerformanceSnapshotRepository.findByUserIdAndPerformanceDateLessThanEqualOrderByPerformanceDateAsc(
				userId,
				performanceDate
		)).thenReturn(List.of(existing));
		when(dailyPerformanceSnapshotRepository.findByUserIdAndPerformanceDate(userId, performanceDate))
				.thenReturn(Optional.of(existing));
		when(dailyPerformanceSnapshotRepository.save(existing)).thenReturn(existing);

		DailyPerformanceSnapshot snapshot = service.recordDailySnapshot(userId, performanceDate);

		assertThat(snapshot).isSameAs(existing);
		assertThat(snapshot.getTotalPortfolioValue()).isEqualByComparingTo("101000.00");
		assertThat(snapshot.getCashBalance()).isEqualByComparingTo("81000.00");
		assertThat(snapshot.getPeriodReturnPercent()).isEqualByComparingTo("0.00");
		verify(dailyPerformanceSnapshotRepository).save(existing);
	}

	@Test
	void usesPriorSnapshotAsPerformanceBaseline() {
		UUID userId = UUID.randomUUID();
		LocalDate priorDate = LocalDate.parse("2025-07-05");
		LocalDate performanceDate = LocalDate.parse("2026-07-05");
		DailyPerformanceSnapshot prior = snapshot(userId, priorDate, "100000.00", "0.00", "0.00", null);
		when(portfolioValuationService.getPortfolio(userId)).thenReturn(portfolio(
				"110000.00",
				"70000.00",
				"40000.00",
				"3000.00",
				"7000.00"
		));
		when(dailyPerformanceSnapshotRepository.findByUserIdAndPerformanceDateLessThanEqualOrderByPerformanceDateAsc(
				userId,
				performanceDate
		)).thenReturn(List.of(prior));
		when(dailyPerformanceSnapshotRepository.findByUserIdAndPerformanceDate(userId, performanceDate))
				.thenReturn(Optional.empty());
		ArgumentCaptor<DailyPerformanceSnapshot> captor = ArgumentCaptor.forClass(DailyPerformanceSnapshot.class);
		when(dailyPerformanceSnapshotRepository.save(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

		DailyPerformanceSnapshot snapshot = service.recordDailySnapshot(userId, performanceDate);

		assertThat(snapshot.getPeriodReturnPercent()).isEqualByComparingTo("10.00");
		assertThat(snapshot.getCumulativeTwrPercent()).isEqualByComparingTo("10.00");
		assertThat(snapshot.getCumulativeMwrPercent()).isEqualByComparingTo("10.00");
	}

	private DailyPerformanceSnapshot snapshot(
			UUID userId,
			LocalDate performanceDate,
			String totalPortfolioValue,
			String periodReturnPercent,
			String cumulativeTwrPercent,
			String cumulativeMwrPercent
	) {
		return new DailyPerformanceSnapshot(
				userId,
				performanceDate,
				bd(totalPortfolioValue),
				bd(totalPortfolioValue),
				BigDecimal.ZERO,
				BigDecimal.ZERO,
				BigDecimal.ZERO,
				BigDecimal.ZERO,
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
			String unrealizedPnl
	) {
		return new PortfolioResponse(
				new PortfolioSummaryResponse(
						new BigDecimal("100000.00"),
						bd(cashBalance),
						BigDecimal.ZERO,
						bd(cashBalance),
						bd(holdingsMarketValue),
						bd(totalPortfolioValue),
						bd(unrealizedPnl),
						bd(realizedPnl),
						bd(realizedPnl).add(bd(unrealizedPnl)),
						BigDecimal.ZERO,
						BigDecimal.ZERO
				),
				List.of()
		);
	}

	private BigDecimal bd(String value) {
		return new BigDecimal(value);
	}
}

package com.papervest.portfolio.service;

import com.papervest.common.util.MoneyUtils;
import com.papervest.portfolio.dto.HoldingResponse;
import com.papervest.portfolio.dto.PortfolioAllocationResponse;
import com.papervest.portfolio.dto.PortfolioHoldingContributionResponse;
import com.papervest.portfolio.dto.PortfolioPerformancePointResponse;
import com.papervest.portfolio.dto.PortfolioPerformanceResponse;
import com.papervest.portfolio.dto.PortfolioPerformanceSummaryResponse;
import com.papervest.portfolio.dto.PortfolioPnlContributionResponse;
import com.papervest.portfolio.dto.PortfolioResponse;
import com.papervest.portfolio.model.DailyPerformanceSnapshot;
import com.papervest.portfolio.model.PortfolioPerformanceRange;
import com.papervest.portfolio.model.PortfolioPerformanceStatus;
import com.papervest.portfolio.model.PortfolioSnapshot;
import com.papervest.portfolio.repository.DailyPerformanceSnapshotRepository;
import com.papervest.portfolio.repository.PortfolioSnapshotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class PortfolioPerformanceService {

	private static final int TOP_HOLDING_LIMIT = 5;
	private static final long BASELINE_COVERAGE_TOLERANCE_DAYS = 1;
	private static final ZoneId PERFORMANCE_ZONE = ZoneId.of("America/New_York");

	private final PortfolioSnapshotRepository portfolioSnapshotRepository;
	private final DailyPerformanceSnapshotRepository dailyPerformanceSnapshotRepository;
	private final PortfolioValuationService portfolioValuationService;
	private final PerformanceReturnCalculator performanceReturnCalculator;
	private final Clock clock;

	public PortfolioPerformanceService(
			PortfolioSnapshotRepository portfolioSnapshotRepository,
			DailyPerformanceSnapshotRepository dailyPerformanceSnapshotRepository,
			PortfolioValuationService portfolioValuationService,
			PerformanceReturnCalculator performanceReturnCalculator,
			Clock clock
	) {
		this.portfolioSnapshotRepository = portfolioSnapshotRepository;
		this.dailyPerformanceSnapshotRepository = dailyPerformanceSnapshotRepository;
		this.portfolioValuationService = portfolioValuationService;
		this.performanceReturnCalculator = performanceReturnCalculator;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public PortfolioPerformanceResponse getPerformance(UUID userId, PortfolioPerformanceRange range) {
		Instant now = clock.instant();
		LocalDate today = LocalDate.now(clock.withZone(PERFORMANCE_ZONE));
		List<DailyPerformanceSnapshot> dailySnapshots = dailyPerformanceSnapshotRepository
				.findByUserIdAndPerformanceDateLessThanEqualOrderByPerformanceDateAsc(userId, today);
		if (!dailySnapshots.isEmpty()) {
			return getDailyPerformance(userId, range, dailySnapshots, now);
		}

		return getDerivedPerformance(userId, range, now);
	}

	private PortfolioPerformanceResponse getDerivedPerformance(
			UUID userId,
			PortfolioPerformanceRange range,
			Instant now
	) {
		Instant since = range.since(clock);
		SnapshotSelection snapshotSelection = selectSnapshots(userId, since);
		List<PortfolioSnapshot> snapshots = snapshotSelection.snapshots();
		PortfolioResponse portfolio = portfolioValuationService.getPortfolio(userId);

		BigDecimal currentValue = MoneyUtils.scaleMoney(portfolio.summary().totalPortfolioValue());
		BigDecimal startValue = snapshots.isEmpty()
				? currentValue
				: MoneyUtils.scaleMoney(snapshots.getFirst().getTotalPortfolioValue());
		BigDecimal absoluteReturn = MoneyUtils.scaleMoney(currentValue.subtract(startValue));
		BigDecimal returnPercent = snapshots.isEmpty()
				? zeroPercent()
				: MoneyUtils.percent(absoluteReturn, startValue);
		List<PortfolioPerformancePointResponse> points = buildPoints(snapshots, portfolio, now);
		BigDecimal maxDrawdownPercent = snapshots.isEmpty()
				? zeroPercent()
				: points.stream()
						.map(PortfolioPerformancePointResponse::drawdownPercent)
						.max(BigDecimal::compareTo)
						.orElseGet(this::zeroPercent);
		PortfolioPerformanceStatus status = snapshots.isEmpty() || !snapshotSelection.rangeCovered()
				? PortfolioPerformanceStatus.INSUFFICIENT_HISTORY
				: PortfolioPerformanceStatus.READY;
		Instant from = snapshots.isEmpty() ? null : snapshots.getFirst().getCreatedAt();

		return new PortfolioPerformanceResponse(
				range,
				from,
				now,
				status,
				new PortfolioPerformanceSummaryResponse(
						currentValue,
						startValue,
						currentValue,
						absoluteReturn,
						returnPercent,
						returnPercent,
						returnPercent,
						null,
						zeroMoney(),
						maxDrawdownPercent,
						MoneyUtils.scaleMoney(portfolio.summary().realizedPnl()),
						MoneyUtils.scaleMoney(portfolio.summary().unrealizedPnl())
				),
				allocation(portfolio),
				pnlContribution(portfolio),
				topHoldings(portfolio.holdings(), currentValue),
				points
		);
	}

	private PortfolioPerformanceResponse getDailyPerformance(
			UUID userId,
			PortfolioPerformanceRange range,
			List<DailyPerformanceSnapshot> allDailySnapshots,
			Instant now
	) {
		DailySnapshotSelection snapshotSelection = selectDailySnapshots(allDailySnapshots, range);
		List<DailyPerformanceSnapshot> snapshots = snapshotSelection.snapshots();
		PortfolioResponse portfolio = portfolioValuationService.getPortfolio(userId);
		DailyPerformanceSnapshot firstSnapshot = snapshots.getFirst();
		DailyPerformanceSnapshot latestSnapshot = snapshots.getLast();

		BigDecimal currentValue = MoneyUtils.scaleMoney(portfolio.summary().totalPortfolioValue());
		BigDecimal startValue = MoneyUtils.scaleMoney(firstSnapshot.getTotalPortfolioValue());
		BigDecimal endValue = MoneyUtils.scaleMoney(latestSnapshot.getTotalPortfolioValue());
		BigDecimal netCashFlow = rangeNetCashFlow(snapshots);
		BigDecimal absoluteReturn = MoneyUtils.scaleMoney(endValue.subtract(startValue).subtract(netCashFlow));
		BigDecimal timeWeightedReturnPercent = rangeTimeWeightedReturnPercent(snapshots);
		List<PortfolioPerformancePointResponse> points = buildDailyPoints(snapshots);
		BigDecimal maxDrawdownPercent = points.stream()
				.map(PortfolioPerformancePointResponse::drawdownPercent)
				.max(BigDecimal::compareTo)
				.orElseGet(this::zeroPercent);
		PortfolioPerformanceStatus status = snapshotSelection.rangeCovered()
				? PortfolioPerformanceStatus.READY
				: PortfolioPerformanceStatus.INSUFFICIENT_HISTORY;

		return new PortfolioPerformanceResponse(
				range,
				dateAtStartOfDayUtc(firstSnapshot.getPerformanceDate()),
				now,
				status,
				new PortfolioPerformanceSummaryResponse(
						currentValue,
						startValue,
						endValue,
						absoluteReturn,
						timeWeightedReturnPercent,
						MoneyUtils.scaleMoney(latestSnapshot.getPeriodReturnPercent()),
						timeWeightedReturnPercent,
						latestSnapshot.getCumulativeMwrPercent(),
						netCashFlow,
						maxDrawdownPercent,
						MoneyUtils.scaleMoney(portfolio.summary().realizedPnl()),
						MoneyUtils.scaleMoney(portfolio.summary().unrealizedPnl())
				),
				allocation(portfolio),
				pnlContribution(portfolio),
				topHoldings(portfolio.holdings(), currentValue),
				points
		);
	}

	private SnapshotSelection selectSnapshots(UUID userId, Instant since) {
		if (since == null) {
			return new SnapshotSelection(
					portfolioSnapshotRepository.findByUserIdOrderByCreatedAtAsc(userId),
					true
			);
		}

		List<PortfolioSnapshot> snapshots = new ArrayList<>(
				portfolioSnapshotRepository.findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(userId, since)
		);
		var baselineSnapshot = portfolioSnapshotRepository
				.findFirstByUserIdAndCreatedAtLessThanEqualOrderByCreatedAtDesc(userId, since);

		if (baselineSnapshot.isEmpty()) {
			return new SnapshotSelection(snapshots, false);
		}

		PortfolioSnapshot baseline = baselineSnapshot.get();
		if (snapshots.isEmpty() || !sameSnapshot(baseline, snapshots.getFirst())) {
			snapshots.addFirst(baseline);
		}
		return new SnapshotSelection(snapshots, coversRangeStart(baseline, since));
	}

	private DailySnapshotSelection selectDailySnapshots(
			List<DailyPerformanceSnapshot> allDailySnapshots,
			PortfolioPerformanceRange range
	) {
		LocalDate rangeStart = rangeStartDate(range);
		if (rangeStart == null) {
			return new DailySnapshotSelection(allDailySnapshots, true);
		}

		List<DailyPerformanceSnapshot> selectedSnapshots = new ArrayList<>();
		DailyPerformanceSnapshot baseline = null;
		for (DailyPerformanceSnapshot snapshot : allDailySnapshots) {
			if (!snapshot.getPerformanceDate().isAfter(rangeStart)) {
				baseline = snapshot;
			}
		}
		if (baseline != null) {
			selectedSnapshots.add(baseline);
		}
		for (DailyPerformanceSnapshot snapshot : allDailySnapshots) {
			if (!snapshot.getPerformanceDate().isBefore(rangeStart)
					&& selectedSnapshots.stream().noneMatch(selected -> sameDailySnapshot(selected, snapshot))) {
				selectedSnapshots.add(snapshot);
			}
		}
		if (selectedSnapshots.isEmpty()) {
			selectedSnapshots.addAll(allDailySnapshots);
		}

		boolean rangeCovered = baseline != null
				&& !baseline.getPerformanceDate().isBefore(rangeStart.minusDays(BASELINE_COVERAGE_TOLERANCE_DAYS));
		return new DailySnapshotSelection(selectedSnapshots, rangeCovered);
	}

	private boolean sameDailySnapshot(DailyPerformanceSnapshot left, DailyPerformanceSnapshot right) {
		return left.getPerformanceDate().equals(right.getPerformanceDate())
				&& left.getTotalPortfolioValue().compareTo(right.getTotalPortfolioValue()) == 0
				&& left.getCashBalance().compareTo(right.getCashBalance()) == 0
				&& left.getHoldingsMarketValue().compareTo(right.getHoldingsMarketValue()) == 0;
	}

	private LocalDate rangeStartDate(PortfolioPerformanceRange range) {
		Instant since = range.since(clock);
		return since == null ? null : LocalDate.ofInstant(since, PERFORMANCE_ZONE);
	}

	private boolean coversRangeStart(PortfolioSnapshot baseline, Instant since) {
		return !baseline.getCreatedAt().isBefore(since.minus(BASELINE_COVERAGE_TOLERANCE_DAYS, ChronoUnit.DAYS));
	}

	private boolean sameSnapshot(PortfolioSnapshot left, PortfolioSnapshot right) {
		return left.getCreatedAt().equals(right.getCreatedAt())
				&& left.getTotalPortfolioValue().compareTo(right.getTotalPortfolioValue()) == 0
				&& left.getCashBalance().compareTo(right.getCashBalance()) == 0
				&& left.getHoldingsMarketValue().compareTo(right.getHoldingsMarketValue()) == 0
				&& left.getRealizedPnl().compareTo(right.getRealizedPnl()) == 0
				&& left.getUnrealizedPnl().compareTo(right.getUnrealizedPnl()) == 0;
	}

	private List<PortfolioPerformancePointResponse> buildDailyPoints(List<DailyPerformanceSnapshot> snapshots) {
		List<PortfolioPerformancePointResponse> points = new ArrayList<>();
		BigDecimal peak = BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE);

		for (DailyPerformanceSnapshot snapshot : snapshots) {
			BigDecimal value = MoneyUtils.scaleMoney(snapshot.getTotalPortfolioValue());
			if (value.compareTo(peak) > 0) {
				peak = value;
			}
			points.add(new PortfolioPerformancePointResponse(
					dateAtStartOfDayUtc(snapshot.getPerformanceDate()),
					snapshot.getPerformanceDate(),
					value,
					MoneyUtils.scaleMoney(snapshot.getCashBalance()),
					MoneyUtils.scaleMoney(snapshot.getHoldingsMarketValue()),
					snapshot.getPeriodReturnPercent(),
					snapshot.getCumulativeTwrPercent(),
					snapshot.getCumulativeMwrPercent(),
					MoneyUtils.scaleMoney(snapshot.getNetCashFlow()),
					drawdownPercent(peak, value)
			));
		}

		return points;
	}

	private List<PortfolioPerformancePointResponse> buildPoints(
			List<PortfolioSnapshot> snapshots,
			PortfolioResponse portfolio,
			Instant now
	) {
		List<PortfolioPerformancePointResponse> points = new ArrayList<>();
		BigDecimal peak = BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE);

		for (PortfolioSnapshot snapshot : snapshots) {
			BigDecimal value = MoneyUtils.scaleMoney(snapshot.getTotalPortfolioValue());
			if (value.compareTo(peak) > 0) {
				peak = value;
			}
			points.add(new PortfolioPerformancePointResponse(
					snapshot.getCreatedAt(),
					null,
					value,
					MoneyUtils.scaleMoney(snapshot.getCashBalance()),
					MoneyUtils.scaleMoney(snapshot.getHoldingsMarketValue()),
					zeroPercent(),
					zeroPercent(),
					null,
					zeroMoney(),
					drawdownPercent(peak, value)
			));
		}

		BigDecimal currentValue = MoneyUtils.scaleMoney(portfolio.summary().totalPortfolioValue());
		if (currentValue.compareTo(peak) > 0) {
			peak = currentValue;
		}
		PortfolioPerformancePointResponse currentPoint = new PortfolioPerformancePointResponse(
				now,
				null,
				currentValue,
				MoneyUtils.scaleMoney(portfolio.summary().cashBalance()),
				MoneyUtils.scaleMoney(portfolio.summary().holdingsMarketValue()),
				zeroPercent(),
				zeroPercent(),
				null,
				zeroMoney(),
				drawdownPercent(peak, currentValue)
		);

		if (points.isEmpty() || !isDuplicate(points.getLast(), currentPoint)) {
			points.add(currentPoint);
		}

		return points;
	}

	private boolean isDuplicate(
			PortfolioPerformancePointResponse previous,
			PortfolioPerformancePointResponse current
	) {
		return previous.timestamp().equals(current.timestamp())
				&& previous.totalPortfolioValue().compareTo(current.totalPortfolioValue()) == 0
				&& previous.cashBalance().compareTo(current.cashBalance()) == 0
				&& previous.holdingsMarketValue().compareTo(current.holdingsMarketValue()) == 0;
	}

	private PortfolioAllocationResponse allocation(PortfolioResponse portfolio) {
		BigDecimal total = portfolio.summary().totalPortfolioValue();
		BigDecimal cashValue = MoneyUtils.scaleMoney(portfolio.summary().cashBalance());
		BigDecimal holdingsValue = MoneyUtils.scaleMoney(portfolio.summary().holdingsMarketValue());

		return new PortfolioAllocationResponse(
				cashValue,
				MoneyUtils.percent(cashValue, total),
				holdingsValue,
				MoneyUtils.percent(holdingsValue, total)
		);
	}

	private PortfolioPnlContributionResponse pnlContribution(PortfolioResponse portfolio) {
		BigDecimal realized = MoneyUtils.scaleMoney(portfolio.summary().realizedPnl());
		BigDecimal unrealized = MoneyUtils.scaleMoney(portfolio.summary().unrealizedPnl());
		BigDecimal denominator = realized.abs().add(unrealized.abs());

		return new PortfolioPnlContributionResponse(
				realized,
				MoneyUtils.percent(realized.abs(), denominator),
				unrealized,
				MoneyUtils.percent(unrealized.abs(), denominator)
		);
	}

	private List<PortfolioHoldingContributionResponse> topHoldings(
			List<HoldingResponse> holdings,
			BigDecimal totalPortfolioValue
	) {
		List<HoldingResponse> sortedHoldings = holdings.stream()
				.sorted(Comparator
						.comparing(HoldingResponse::unrealizedPnl, Comparator.reverseOrder())
						.thenComparing(HoldingResponse::marketValue, Comparator.reverseOrder())
						.thenComparing(HoldingResponse::symbol))
				.limit(TOP_HOLDING_LIMIT)
				.toList();

		List<PortfolioHoldingContributionResponse> response = new ArrayList<>();
		for (int index = 0; index < sortedHoldings.size(); index++) {
			HoldingResponse holding = sortedHoldings.get(index);
			response.add(new PortfolioHoldingContributionResponse(
					index + 1,
					holding.symbol(),
					holding.companyName(),
					MoneyUtils.scaleMoney(holding.marketValue()),
					MoneyUtils.percent(holding.marketValue(), totalPortfolioValue),
					MoneyUtils.scaleMoney(holding.unrealizedPnl()),
					holding.unrealizedPnlPercent()
			));
		}
		return response;
	}

	private BigDecimal drawdownPercent(BigDecimal peak, BigDecimal value) {
		if (peak.compareTo(BigDecimal.ZERO) <= 0 || value.compareTo(peak) >= 0) {
			return zeroPercent();
		}
		return MoneyUtils.percent(peak.subtract(value), peak);
	}

	private BigDecimal rangeNetCashFlow(List<DailyPerformanceSnapshot> snapshots) {
		BigDecimal netCashFlow = zeroMoney();
		for (int index = 1; index < snapshots.size(); index++) {
			netCashFlow = netCashFlow.add(snapshots.get(index).getNetCashFlow());
		}
		return MoneyUtils.scaleMoney(netCashFlow);
	}

	private BigDecimal rangeTimeWeightedReturnPercent(List<DailyPerformanceSnapshot> snapshots) {
		if (snapshots.size() < 2) {
			return zeroPercent();
		}
		List<BigDecimal> periodReturns = snapshots.subList(1, snapshots.size())
				.stream()
				.map(DailyPerformanceSnapshot::getPeriodReturnPercent)
				.toList();
		return performanceReturnCalculator.chainTwrPercent(periodReturns);
	}

	private Instant dateAtStartOfDayUtc(LocalDate date) {
		return date.atStartOfDay(ZoneOffset.UTC).toInstant();
	}

	private BigDecimal zeroMoney() {
		return BigDecimal.ZERO.setScale(2);
	}

	private BigDecimal zeroPercent() {
		return BigDecimal.ZERO.setScale(2);
	}

	private record SnapshotSelection(List<PortfolioSnapshot> snapshots, boolean rangeCovered) {
	}

	private record DailySnapshotSelection(List<DailyPerformanceSnapshot> snapshots, boolean rangeCovered) {
	}
}

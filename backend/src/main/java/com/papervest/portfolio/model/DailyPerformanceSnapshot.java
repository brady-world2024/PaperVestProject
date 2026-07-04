package com.papervest.portfolio.model;

import com.papervest.common.util.MoneyUtils;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "daily_performance_snapshots")
public class DailyPerformanceSnapshot {

	private static final int PERCENT_SCALE = 2;

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(name = "performance_date", nullable = false)
	private LocalDate performanceDate;

	@Column(name = "total_portfolio_value", nullable = false, precision = 19, scale = 2)
	private BigDecimal totalPortfolioValue;

	@Column(name = "cash_balance", nullable = false, precision = 19, scale = 2)
	private BigDecimal cashBalance;

	@Column(name = "holdings_market_value", nullable = false, precision = 19, scale = 2)
	private BigDecimal holdingsMarketValue;

	@Column(name = "realized_pnl", nullable = false, precision = 19, scale = 2)
	private BigDecimal realizedPnl;

	@Column(name = "unrealized_pnl", nullable = false, precision = 19, scale = 2)
	private BigDecimal unrealizedPnl;

	@Column(name = "net_cash_flow", nullable = false, precision = 19, scale = 2)
	private BigDecimal netCashFlow;

	@Column(name = "period_return_percent", nullable = false, precision = 19, scale = 2)
	private BigDecimal periodReturnPercent;

	@Column(name = "cumulative_twr_percent", nullable = false, precision = 19, scale = 2)
	private BigDecimal cumulativeTwrPercent;

	@Column(name = "cumulative_mwr_percent", precision = 19, scale = 2)
	private BigDecimal cumulativeMwrPercent;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected DailyPerformanceSnapshot() {
	}

	public DailyPerformanceSnapshot(
			UUID userId,
			LocalDate performanceDate,
			BigDecimal totalPortfolioValue,
			BigDecimal cashBalance,
			BigDecimal holdingsMarketValue,
			BigDecimal realizedPnl,
			BigDecimal unrealizedPnl,
			BigDecimal netCashFlow,
			BigDecimal periodReturnPercent,
			BigDecimal cumulativeTwrPercent,
			BigDecimal cumulativeMwrPercent
	) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.performanceDate = performanceDate;
		updateValues(
				totalPortfolioValue,
				cashBalance,
				holdingsMarketValue,
				realizedPnl,
				unrealizedPnl,
				netCashFlow,
				periodReturnPercent,
				cumulativeTwrPercent,
				cumulativeMwrPercent
		);
	}

	public void updateValues(
			BigDecimal totalPortfolioValue,
			BigDecimal cashBalance,
			BigDecimal holdingsMarketValue,
			BigDecimal realizedPnl,
			BigDecimal unrealizedPnl,
			BigDecimal netCashFlow,
			BigDecimal periodReturnPercent,
			BigDecimal cumulativeTwrPercent,
			BigDecimal cumulativeMwrPercent
	) {
		this.totalPortfolioValue = MoneyUtils.scaleMoney(totalPortfolioValue);
		this.cashBalance = MoneyUtils.scaleMoney(cashBalance);
		this.holdingsMarketValue = MoneyUtils.scaleMoney(holdingsMarketValue);
		this.realizedPnl = MoneyUtils.scaleMoney(realizedPnl);
		this.unrealizedPnl = MoneyUtils.scaleMoney(unrealizedPnl);
		this.netCashFlow = MoneyUtils.scaleMoney(netCashFlow);
		this.periodReturnPercent = scalePercent(periodReturnPercent);
		this.cumulativeTwrPercent = scalePercent(cumulativeTwrPercent);
		this.cumulativeMwrPercent = cumulativeMwrPercent == null ? null : scalePercent(cumulativeMwrPercent);
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		if (id == null) {
			id = UUID.randomUUID();
		}
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public UUID getUserId() {
		return userId;
	}

	public LocalDate getPerformanceDate() {
		return performanceDate;
	}

	public BigDecimal getTotalPortfolioValue() {
		return totalPortfolioValue;
	}

	public BigDecimal getCashBalance() {
		return cashBalance;
	}

	public BigDecimal getHoldingsMarketValue() {
		return holdingsMarketValue;
	}

	public BigDecimal getRealizedPnl() {
		return realizedPnl;
	}

	public BigDecimal getUnrealizedPnl() {
		return unrealizedPnl;
	}

	public BigDecimal getNetCashFlow() {
		return netCashFlow;
	}

	public BigDecimal getPeriodReturnPercent() {
		return periodReturnPercent;
	}

	public BigDecimal getCumulativeTwrPercent() {
		return cumulativeTwrPercent;
	}

	public BigDecimal getCumulativeMwrPercent() {
		return cumulativeMwrPercent;
	}

	private BigDecimal scalePercent(BigDecimal value) {
		return value.setScale(PERCENT_SCALE, RoundingMode.HALF_UP);
	}
}

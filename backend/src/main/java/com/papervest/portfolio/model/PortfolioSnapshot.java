package com.papervest.portfolio.model;

import com.papervest.common.util.MoneyUtils;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "portfolio_snapshots")
public class PortfolioSnapshot {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

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

	@Enumerated(EnumType.STRING)
	@Column(name = "snapshot_source", nullable = false, length = 32)
	private PortfolioSnapshotSource snapshotSource;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected PortfolioSnapshot() {
	}

	public PortfolioSnapshot(
			UUID userId,
			BigDecimal totalPortfolioValue,
			BigDecimal cashBalance,
			BigDecimal holdingsMarketValue,
			BigDecimal realizedPnl,
			BigDecimal unrealizedPnl,
			PortfolioSnapshotSource snapshotSource,
			Instant createdAt
	) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.totalPortfolioValue = MoneyUtils.scaleMoney(totalPortfolioValue);
		this.cashBalance = MoneyUtils.scaleMoney(cashBalance);
		this.holdingsMarketValue = MoneyUtils.scaleMoney(holdingsMarketValue);
		this.realizedPnl = MoneyUtils.scaleMoney(realizedPnl);
		this.unrealizedPnl = MoneyUtils.scaleMoney(unrealizedPnl);
		this.snapshotSource = snapshotSource;
		this.createdAt = createdAt;
	}

	@PrePersist
	void onCreate() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (createdAt == null) {
			createdAt = Instant.now();
		}
	}

	public UUID getUserId() {
		return userId;
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

	public PortfolioSnapshotSource getSnapshotSource() {
		return snapshotSource;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}

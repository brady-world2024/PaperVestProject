package com.papervest.portfolio.model;

import com.papervest.common.util.MoneyUtils;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_accounts")
public class UserAccount {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false, unique = true)
	private UUID userId;

	@Column(name = "initial_cash", nullable = false, precision = 19, scale = 2)
	private BigDecimal initialCash;

	@Column(name = "cash_balance", nullable = false, precision = 19, scale = 2)
	private BigDecimal cashBalance;

	@Column(name = "realized_pnl", nullable = false, precision = 19, scale = 2)
	private BigDecimal realizedPnl;

	@Version
	private long version;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected UserAccount() {
	}

	public UserAccount(UUID userId, BigDecimal initialCash) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.initialCash = MoneyUtils.scaleMoney(initialCash);
		this.cashBalance = MoneyUtils.scaleMoney(initialCash);
		this.realizedPnl = BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE);
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

	public UUID getUserId() {
		return userId;
	}

	public BigDecimal getInitialCash() {
		return initialCash;
	}

	public BigDecimal getCashBalance() {
		return cashBalance;
	}

	public BigDecimal getRealizedPnl() {
		return realizedPnl;
	}

	public void debit(BigDecimal amount) {
		cashBalance = MoneyUtils.scaleMoney(cashBalance.subtract(amount));
	}

	public void credit(BigDecimal amount) {
		cashBalance = MoneyUtils.scaleMoney(cashBalance.add(amount));
	}

	public void addRealizedPnl(BigDecimal amount) {
		realizedPnl = MoneyUtils.scaleMoney(realizedPnl.add(amount));
	}
}

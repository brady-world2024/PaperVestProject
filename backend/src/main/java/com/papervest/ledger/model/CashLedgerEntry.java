package com.papervest.ledger.model;

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
@Table(name = "cash_ledger_entries")
public class CashLedgerEntry {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(name = "order_id")
	private UUID orderId;

	@Column(name = "trade_id")
	private UUID tradeId;

	@Enumerated(EnumType.STRING)
	@Column(name = "entry_type", nullable = false, length = 32)
	private CashLedgerEntryType entryType;

	@Column(nullable = false, precision = 19, scale = 2)
	private BigDecimal amount;

	@Column(name = "cash_balance_after", nullable = false, precision = 19, scale = 2)
	private BigDecimal cashBalanceAfter;

	@Column(name = "reserved_cash_after", nullable = false, precision = 19, scale = 2)
	private BigDecimal reservedCashAfter;

	@Column(name = "idempotency_key")
	private String idempotencyKey;

	@Column(length = 255)
	private String memo;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected CashLedgerEntry() {
	}

	public CashLedgerEntry(
			UUID userId,
			UUID orderId,
			UUID tradeId,
			CashLedgerEntryType entryType,
			BigDecimal amount,
			BigDecimal cashBalanceAfter,
			BigDecimal reservedCashAfter,
			String idempotencyKey,
			String memo
	) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.orderId = orderId;
		this.tradeId = tradeId;
		this.entryType = entryType;
		this.amount = MoneyUtils.scaleMoney(amount);
		this.cashBalanceAfter = MoneyUtils.scaleMoney(cashBalanceAfter);
		this.reservedCashAfter = MoneyUtils.scaleMoney(reservedCashAfter);
		this.idempotencyKey = idempotencyKey;
		this.memo = memo;
	}

	@PrePersist
	void onCreate() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		createdAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public UUID getUserId() {
		return userId;
	}

	public UUID getOrderId() {
		return orderId;
	}

	public UUID getTradeId() {
		return tradeId;
	}

	public CashLedgerEntryType getEntryType() {
		return entryType;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public BigDecimal getCashBalanceAfter() {
		return cashBalanceAfter;
	}

	public BigDecimal getReservedCashAfter() {
		return reservedCashAfter;
	}

	public String getIdempotencyKey() {
		return idempotencyKey;
	}

	public String getMemo() {
		return memo;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}

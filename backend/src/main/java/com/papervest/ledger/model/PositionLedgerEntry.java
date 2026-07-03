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
@Table(name = "position_ledger_entries")
public class PositionLedgerEntry {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(nullable = false, length = 16)
	private String symbol;

	@Column(name = "order_id")
	private UUID orderId;

	@Column(name = "trade_id")
	private UUID tradeId;

	@Enumerated(EnumType.STRING)
	@Column(name = "entry_type", nullable = false, length = 32)
	private PositionLedgerEntryType entryType;

	@Column(name = "quantity_delta", nullable = false, precision = 19, scale = 4)
	private BigDecimal quantityDelta;

	@Column(name = "quantity_after", nullable = false, precision = 19, scale = 4)
	private BigDecimal quantityAfter;

	@Column(name = "reserved_quantity_after", nullable = false, precision = 19, scale = 4)
	private BigDecimal reservedQuantityAfter;

	@Column(name = "idempotency_key")
	private String idempotencyKey;

	@Column(length = 255)
	private String memo;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected PositionLedgerEntry() {
	}

	public PositionLedgerEntry(
			UUID userId,
			String symbol,
			UUID orderId,
			UUID tradeId,
			PositionLedgerEntryType entryType,
			BigDecimal quantityDelta,
			BigDecimal quantityAfter,
			BigDecimal reservedQuantityAfter,
			String idempotencyKey,
			String memo
	) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.symbol = symbol;
		this.orderId = orderId;
		this.tradeId = tradeId;
		this.entryType = entryType;
		this.quantityDelta = MoneyUtils.scaleQuantity(quantityDelta);
		this.quantityAfter = MoneyUtils.scaleQuantity(quantityAfter);
		this.reservedQuantityAfter = MoneyUtils.scaleQuantity(reservedQuantityAfter);
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

	public String getSymbol() {
		return symbol;
	}

	public UUID getOrderId() {
		return orderId;
	}

	public UUID getTradeId() {
		return tradeId;
	}

	public PositionLedgerEntryType getEntryType() {
		return entryType;
	}

	public BigDecimal getQuantityDelta() {
		return quantityDelta;
	}

	public BigDecimal getQuantityAfter() {
		return quantityAfter;
	}

	public BigDecimal getReservedQuantityAfter() {
		return reservedQuantityAfter;
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

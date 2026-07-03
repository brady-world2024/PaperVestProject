package com.papervest.trading.model;

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
@Table(name = "trades")
public class Trade {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(nullable = false, length = 16)
	private String symbol;

	@Column(name = "company_name", nullable = false)
	private String companyName;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private TradeSide side;

	@Column(nullable = false, precision = 19, scale = 4)
	private BigDecimal quantity;

	@Column(name = "executed_price", nullable = false, precision = 19, scale = 4)
	private BigDecimal executedPrice;

	@Column(name = "gross_amount", nullable = false, precision = 19, scale = 2)
	private BigDecimal grossAmount;

	@Column(name = "realized_pnl", nullable = false, precision = 19, scale = 2)
	private BigDecimal realizedPnl;

	@Column(name = "cash_balance_after_trade", nullable = false, precision = 19, scale = 2)
	private BigDecimal cashBalanceAfterTrade;

	@Column(name = "idempotency_key")
	private String idempotencyKey;

	@Column(name = "execution_key", unique = true)
	private String executionKey;

	@Column(name = "order_id")
	private UUID orderId;

	@Column(name = "executed_at", nullable = false)
	private Instant executedAt;

	protected Trade() {
	}

	public Trade(
			UUID userId,
			String symbol,
			String companyName,
			TradeSide side,
			BigDecimal quantity,
			BigDecimal executedPrice,
			BigDecimal grossAmount,
			BigDecimal realizedPnl,
			BigDecimal cashBalanceAfterTrade,
			String idempotencyKey,
			String executionKey
	) {
		this(
				userId,
				symbol,
				companyName,
				side,
				quantity,
				executedPrice,
				grossAmount,
				realizedPnl,
				cashBalanceAfterTrade,
				idempotencyKey,
				executionKey,
				null
		);
	}

	public Trade(
			UUID userId,
			String symbol,
			String companyName,
			TradeSide side,
			BigDecimal quantity,
			BigDecimal executedPrice,
			BigDecimal grossAmount,
			BigDecimal realizedPnl,
			BigDecimal cashBalanceAfterTrade,
			String idempotencyKey,
			String executionKey,
			UUID orderId
	) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.symbol = symbol;
		this.companyName = companyName;
		this.side = side;
		this.quantity = MoneyUtils.scaleQuantity(quantity);
		this.executedPrice = MoneyUtils.scalePrice(executedPrice);
		this.grossAmount = MoneyUtils.scaleMoney(grossAmount);
		this.realizedPnl = MoneyUtils.scaleMoney(realizedPnl);
		this.cashBalanceAfterTrade = MoneyUtils.scaleMoney(cashBalanceAfterTrade);
		this.idempotencyKey = idempotencyKey;
		this.executionKey = executionKey;
		this.orderId = orderId;
	}

	@PrePersist
	void onCreate() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		executedAt = Instant.now();
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

	public String getCompanyName() {
		return companyName;
	}

	public TradeSide getSide() {
		return side;
	}

	public BigDecimal getQuantity() {
		return quantity;
	}

	public BigDecimal getExecutedPrice() {
		return executedPrice;
	}

	public BigDecimal getGrossAmount() {
		return grossAmount;
	}

	public BigDecimal getRealizedPnl() {
		return realizedPnl;
	}

	public BigDecimal getCashBalanceAfterTrade() {
		return cashBalanceAfterTrade;
	}

	public Instant getExecutedAt() {
		return executedAt;
	}

	public String getExecutionKey() {
		return executionKey;
	}

	public UUID getOrderId() {
		return orderId;
	}
}

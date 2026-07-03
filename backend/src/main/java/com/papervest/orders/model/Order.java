package com.papervest.orders.model;

import com.papervest.common.util.MoneyUtils;
import com.papervest.common.util.SymbolUtils;
import com.papervest.trading.model.TradeSide;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "orders")
public class Order {

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

	@Enumerated(EnumType.STRING)
	@Column(name = "order_type", nullable = false, length = 32)
	private OrderType orderType;

	@Enumerated(EnumType.STRING)
	@Column(name = "time_in_force", nullable = false, length = 16)
	private OrderTimeInForce timeInForce;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private OrderStatus status;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private OrderSource source;

	@Column(name = "source_ref_id")
	private UUID sourceRefId;

	@Column(name = "requested_quantity", nullable = false, precision = 19, scale = 4)
	private BigDecimal requestedQuantity;

	@Column(name = "filled_quantity", nullable = false, precision = 19, scale = 4)
	private BigDecimal filledQuantity;

	@Column(name = "limit_price", precision = 19, scale = 4)
	private BigDecimal limitPrice;

	@Column(name = "stop_price", precision = 19, scale = 4)
	private BigDecimal stopPrice;

	@Column(name = "estimated_gross_amount", precision = 19, scale = 2)
	private BigDecimal estimatedGrossAmount;

	@Column(name = "reserved_cash_amount", nullable = false, precision = 19, scale = 2)
	private BigDecimal reservedCashAmount;

	@Column(name = "reserved_quantity", nullable = false, precision = 19, scale = 4)
	private BigDecimal reservedQuantity;

	@Column(name = "idempotency_key")
	private String idempotencyKey;

	@Column(name = "rejection_code", length = 64)
	private String rejectionCode;

	@Column(name = "rejection_message", length = 255)
	private String rejectionMessage;

	@Column(name = "submitted_at", nullable = false)
	private Instant submittedAt;

	@Column(name = "accepted_at")
	private Instant acceptedAt;

	@Column(name = "completed_at")
	private Instant completedAt;

	@Column(name = "cancelled_at")
	private Instant cancelledAt;

	@Column(name = "expires_at")
	private Instant expiresAt;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	private long version;

	protected Order() {
	}

	public Order(
			UUID userId,
			String symbol,
			String companyName,
			TradeSide side,
			OrderType orderType,
			OrderTimeInForce timeInForce,
			OrderSource source,
			UUID sourceRefId,
			BigDecimal requestedQuantity,
			BigDecimal limitPrice,
			BigDecimal stopPrice,
			String idempotencyKey
	) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.symbol = SymbolUtils.normalize(symbol);
		this.companyName = companyName == null || companyName.isBlank() ? this.symbol : companyName;
		this.side = side;
		this.orderType = orderType;
		this.timeInForce = timeInForce;
		this.status = OrderStatus.CREATED;
		this.source = source;
		this.sourceRefId = sourceRefId;
		this.requestedQuantity = MoneyUtils.scaleQuantity(requestedQuantity);
		this.filledQuantity = BigDecimal.ZERO.setScale(MoneyUtils.QUANTITY_SCALE);
		this.limitPrice = limitPrice == null ? null : MoneyUtils.scalePrice(limitPrice);
		this.stopPrice = stopPrice == null ? null : MoneyUtils.scalePrice(stopPrice);
		this.reservedCashAmount = BigDecimal.ZERO.setScale(MoneyUtils.MONEY_SCALE);
		this.reservedQuantity = BigDecimal.ZERO.setScale(MoneyUtils.QUANTITY_SCALE);
		this.idempotencyKey = idempotencyKey;
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (submittedAt == null) {
			submittedAt = now;
		}
		if (createdAt == null) {
			createdAt = now;
		}
		updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	public OrderStatus accept() {
		OrderStatus previousStatus = status;
		status = OrderStatus.ACCEPTED;
		acceptedAt = Instant.now();
		return previousStatus;
	}

	public OrderStatus fill(BigDecimal executedQuantity, BigDecimal grossAmount) {
		OrderStatus previousStatus = status;
		filledQuantity = MoneyUtils.scaleQuantity(filledQuantity.add(executedQuantity));
		estimatedGrossAmount = MoneyUtils.scaleMoney(grossAmount);
		status = OrderStatus.FILLED;
		completedAt = Instant.now();
		return previousStatus;
	}

	public OrderStatus markPending(BigDecimal estimatedGrossAmount) {
		OrderStatus previousStatus = status;
		this.estimatedGrossAmount = MoneyUtils.scaleMoney(estimatedGrossAmount);
		status = OrderStatus.PENDING;
		return previousStatus;
	}

	public void assignExpiration(Instant expiresAt) {
		this.expiresAt = expiresAt;
	}

	public void reserveCash(BigDecimal amount) {
		reservedCashAmount = MoneyUtils.scaleMoney(reservedCashAmount.add(amount));
	}

	public void reserveQuantity(BigDecimal quantity) {
		reservedQuantity = MoneyUtils.scaleQuantity(reservedQuantity.add(quantity));
	}

	public void releaseReservedCash(BigDecimal amount) {
		reservedCashAmount = MoneyUtils.scaleMoney(reservedCashAmount.subtract(amount));
	}

	public void releaseReservedQuantity(BigDecimal quantity) {
		reservedQuantity = MoneyUtils.scaleQuantity(reservedQuantity.subtract(quantity));
	}

	public OrderStatus cancel() {
		OrderStatus previousStatus = status;
		status = OrderStatus.CANCELLED;
		cancelledAt = Instant.now();
		completedAt = cancelledAt;
		return previousStatus;
	}

	public OrderStatus expire() {
		OrderStatus previousStatus = status;
		status = OrderStatus.EXPIRED;
		completedAt = Instant.now();
		return previousStatus;
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

	public OrderType getOrderType() {
		return orderType;
	}

	public OrderTimeInForce getTimeInForce() {
		return timeInForce;
	}

	public OrderStatus getStatus() {
		return status;
	}

	public OrderSource getSource() {
		return source;
	}

	public UUID getSourceRefId() {
		return sourceRefId;
	}

	public BigDecimal getRequestedQuantity() {
		return requestedQuantity;
	}

	public BigDecimal getFilledQuantity() {
		return filledQuantity;
	}

	public BigDecimal getLimitPrice() {
		return limitPrice;
	}

	public BigDecimal getStopPrice() {
		return stopPrice;
	}

	public BigDecimal getEstimatedGrossAmount() {
		return estimatedGrossAmount;
	}

	public BigDecimal getReservedCashAmount() {
		return reservedCashAmount;
	}

	public BigDecimal getReservedQuantity() {
		return reservedQuantity;
	}

	public String getIdempotencyKey() {
		return idempotencyKey;
	}

	public String getRejectionCode() {
		return rejectionCode;
	}

	public String getRejectionMessage() {
		return rejectionMessage;
	}

	public Instant getSubmittedAt() {
		return submittedAt;
	}

	public Instant getAcceptedAt() {
		return acceptedAt;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}

	public Instant getCancelledAt() {
		return cancelledAt;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}

package com.papervest.conditionalorder.model;

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
@Table(name = "conditional_orders")
public class ConditionalOrder {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(nullable = false, length = 16)
	private String symbol;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private TradeSide side;

	@Enumerated(EnumType.STRING)
	@Column(name = "trigger_type", nullable = false, length = 32)
	private ConditionalOrderTriggerType triggerType;

	@Column(name = "target_price", nullable = false, precision = 19, scale = 4)
	private BigDecimal targetPrice;

	@Column(nullable = false, precision = 19, scale = 4)
	private BigDecimal quantity;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ConditionalOrderStatus status;

	@Enumerated(EnumType.STRING)
	@Column(name = "failure_code", length = 64)
	private ConditionalOrderFailureCode failureCode;

	@Column(name = "failure_message", length = 255)
	private String failureMessage;

	@Column(name = "execution_key", nullable = false, length = 160, unique = true)
	private String executionKey;

	@Column(name = "last_checked_price", precision = 19, scale = 4)
	private BigDecimal lastCheckedPrice;

	@Column(name = "triggered_at")
	private Instant triggeredAt;

	@Column(name = "executed_at")
	private Instant executedAt;

	@Column(name = "expires_at")
	private Instant expiresAt;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	private long version;

	protected ConditionalOrder() {
	}

	public ConditionalOrder(
			UUID userId,
			String symbol,
			TradeSide side,
			BigDecimal targetPrice,
			BigDecimal quantity,
			Instant expiresAt
	) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.symbol = SymbolUtils.normalize(symbol);
		this.side = side;
		this.triggerType = ConditionalOrderTriggerType.TARGET_PRICE;
		this.targetPrice = MoneyUtils.scalePrice(targetPrice);
		this.quantity = MoneyUtils.scaleQuantity(quantity);
		this.status = ConditionalOrderStatus.ACTIVE;
		this.executionKey = "conditional-order-" + this.id;
		this.expiresAt = expiresAt;
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		if (id == null) {
			id = UUID.randomUUID();
		}
		if (executionKey == null || executionKey.isBlank()) {
			executionKey = "conditional-order-" + id;
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

	public String getSymbol() {
		return symbol;
	}

	public TradeSide getSide() {
		return side;
	}

	public ConditionalOrderTriggerType getTriggerType() {
		return triggerType;
	}

	public BigDecimal getTargetPrice() {
		return targetPrice;
	}

	public BigDecimal getQuantity() {
		return quantity;
	}

	public ConditionalOrderStatus getStatus() {
		return status;
	}

	public ConditionalOrderFailureCode getFailureCode() {
		return failureCode;
	}

	public String getFailureMessage() {
		return failureMessage;
	}

	public String getExecutionKey() {
		return executionKey;
	}

	public BigDecimal getLastCheckedPrice() {
		return lastCheckedPrice;
	}

	public Instant getTriggeredAt() {
		return triggeredAt;
	}

	public Instant getExecutedAt() {
		return executedAt;
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

	public long getVersion() {
		return version;
	}
}

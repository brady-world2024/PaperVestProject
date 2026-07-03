package com.papervest.orders.execution.model;

import com.papervest.common.util.MoneyUtils;
import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderType;
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
@Table(name = "order_execution_requests")
public class OrderExecutionRequest {

	@Id
	private UUID id;

	@Column(name = "order_id", nullable = false)
	private UUID orderId;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(nullable = false, length = 16)
	private String symbol;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private TradeSide side;

	@Enumerated(EnumType.STRING)
	@Column(name = "order_type", nullable = false, length = 32)
	private OrderType orderType;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private OrderExecutionRequestStatus status;

	@Column(name = "trigger_price", nullable = false, precision = 19, scale = 4)
	private BigDecimal triggerPrice;

	@Column(name = "execution_price", nullable = false, precision = 19, scale = 4)
	private BigDecimal executionPrice;

	@Column(name = "quote_timestamp")
	private Instant quoteTimestamp;

	@Column(name = "published_at")
	private Instant publishedAt;

	@Column(name = "consumed_at")
	private Instant consumedAt;

	@Column(name = "last_publish_error")
	private String lastPublishError;

	@Column(name = "publish_attempt_count", nullable = false)
	private int publishAttemptCount;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	private long version;

	protected OrderExecutionRequest() {
	}

	private OrderExecutionRequest(Order order, BigDecimal triggerPrice, Instant quoteTimestamp) {
		this.id = UUID.randomUUID();
		this.orderId = order.getId();
		this.userId = order.getUserId();
		this.symbol = order.getSymbol();
		this.side = order.getSide();
		this.orderType = order.getOrderType();
		this.status = OrderExecutionRequestStatus.PENDING;
		this.triggerPrice = MoneyUtils.scalePrice(triggerPrice);
		this.executionPrice = MoneyUtils.scalePrice(triggerPrice);
		this.quoteTimestamp = quoteTimestamp;
	}

	public static OrderExecutionRequest pending(Order order, BigDecimal triggerPrice, Instant quoteTimestamp) {
		return new OrderExecutionRequest(order, triggerPrice, quoteTimestamp);
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		if (id == null) {
			id = UUID.randomUUID();
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

	public void markPublishAttemptFailed(String message) {
		publishAttemptCount++;
		lastPublishError = message == null ? null : message.substring(0, Math.min(message.length(), 1000));
	}

	public void markPublished() {
		publishAttemptCount++;
		status = OrderExecutionRequestStatus.PUBLISHED;
		publishedAt = Instant.now();
		lastPublishError = null;
	}

	public void markConsumed() {
		status = OrderExecutionRequestStatus.CONSUMED;
		consumedAt = Instant.now();
	}

	public void markCancelled() {
		status = OrderExecutionRequestStatus.CANCELLED;
		consumedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public UUID getOrderId() {
		return orderId;
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

	public OrderType getOrderType() {
		return orderType;
	}

	public OrderExecutionRequestStatus getStatus() {
		return status;
	}

	public BigDecimal getTriggerPrice() {
		return triggerPrice;
	}

	public BigDecimal getExecutionPrice() {
		return executionPrice;
	}

	public Instant getQuoteTimestamp() {
		return quoteTimestamp;
	}

	public Instant getPublishedAt() {
		return publishedAt;
	}

	public Instant getConsumedAt() {
		return consumedAt;
	}

	public String getLastPublishError() {
		return lastPublishError;
	}

	public int getPublishAttemptCount() {
		return publishAttemptCount;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}

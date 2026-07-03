package com.papervest.orders.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_status_events")
public class OrderStatusEvent {

	@Id
	private UUID id;

	@Column(name = "order_id", nullable = false)
	private UUID orderId;

	@Enumerated(EnumType.STRING)
	@Column(name = "from_status", length = 32)
	private OrderStatus fromStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "to_status", nullable = false, length = 32)
	private OrderStatus toStatus;

	@Column(name = "reason_code", length = 64)
	private String reasonCode;

	@Column(name = "reason_message", length = 255)
	private String reasonMessage;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "metadata_json", columnDefinition = "jsonb")
	private String metadataJson;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected OrderStatusEvent() {
	}

	public OrderStatusEvent(
			UUID orderId,
			OrderStatus fromStatus,
			OrderStatus toStatus,
			String reasonCode,
			String reasonMessage,
			String metadataJson
	) {
		this.id = UUID.randomUUID();
		this.orderId = orderId;
		this.fromStatus = fromStatus;
		this.toStatus = toStatus;
		this.reasonCode = reasonCode;
		this.reasonMessage = reasonMessage;
		this.metadataJson = metadataJson;
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

	public UUID getOrderId() {
		return orderId;
	}

	public OrderStatus getFromStatus() {
		return fromStatus;
	}

	public OrderStatus getToStatus() {
		return toStatus;
	}

	public String getReasonCode() {
		return reasonCode;
	}

	public String getReasonMessage() {
		return reasonMessage;
	}

	public String getMetadataJson() {
		return metadataJson;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}

package com.papervest.conditionalorder.model;

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
@Table(name = "conditional_order_status_events")
public class ConditionalOrderStatusEvent {

	@Id
	private UUID id;

	@Column(name = "conditional_order_id", nullable = false)
	private UUID conditionalOrderId;

	@Enumerated(EnumType.STRING)
	@Column(name = "from_status", length = 32)
	private ConditionalOrderStatus fromStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "to_status", nullable = false, length = 32)
	private ConditionalOrderStatus toStatus;

	@Column(name = "reason_code", length = 64)
	private String reasonCode;

	@Column(name = "reason_message", length = 255)
	private String reasonMessage;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "metadata_json", columnDefinition = "jsonb")
	private String metadataJson;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected ConditionalOrderStatusEvent() {
	}

	public ConditionalOrderStatusEvent(
			UUID conditionalOrderId,
			ConditionalOrderStatus fromStatus,
			ConditionalOrderStatus toStatus,
			String reasonCode,
			String reasonMessage,
			String metadataJson
	) {
		this.id = UUID.randomUUID();
		this.conditionalOrderId = conditionalOrderId;
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

	public UUID getConditionalOrderId() {
		return conditionalOrderId;
	}

	public ConditionalOrderStatus getFromStatus() {
		return fromStatus;
	}

	public ConditionalOrderStatus getToStatus() {
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

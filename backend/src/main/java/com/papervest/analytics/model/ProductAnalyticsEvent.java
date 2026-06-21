package com.papervest.analytics.model;

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
@Table(name = "product_analytics_events")
public class ProductAnalyticsEvent {

	@Id
	private UUID id;

	@Column(name = "user_id")
	private UUID userId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ProductAnalyticsEventSource source;

	@Enumerated(EnumType.STRING)
	@Column(name = "event_name", nullable = false, length = 64)
	private ProductAnalyticsEventName eventName;

	@Column(length = 255)
	private String path;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "metadata_json", columnDefinition = "jsonb")
	private String metadataJson;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected ProductAnalyticsEvent() {
	}

	public ProductAnalyticsEvent(
			UUID userId,
			ProductAnalyticsEventSource source,
			ProductAnalyticsEventName eventName,
			String path,
			String metadataJson
	) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.source = source;
		this.eventName = eventName;
		this.path = path;
		this.metadataJson = metadataJson;
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

	public UUID getId() {
		return id;
	}

	public UUID getUserId() {
		return userId;
	}

	public ProductAnalyticsEventSource getSource() {
		return source;
	}

	public ProductAnalyticsEventName getEventName() {
		return eventName;
	}

	public String getPath() {
		return path;
	}

	public String getMetadataJson() {
		return metadataJson;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}

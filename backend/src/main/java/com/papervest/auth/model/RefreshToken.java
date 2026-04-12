package com.papervest.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(name = "token_hash", nullable = false, unique = true, length = 64)
	private String tokenHash;

	@Column(name = "device_name")
	private String deviceName;

	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	@Column(name = "revoked_at")
	private Instant revokedAt;

	@Column(name = "last_used_at")
	private Instant lastUsedAt;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected RefreshToken() {
	}

	public RefreshToken(UUID userId, String tokenHash, String deviceName, Instant expiresAt) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.tokenHash = tokenHash;
		this.deviceName = deviceName;
		this.expiresAt = expiresAt;
	}

	@PrePersist
	void onCreate() {
		if (id == null) {
			id = UUID.randomUUID();
		}
		createdAt = Instant.now();
	}

	public UUID getUserId() {
		return userId;
	}

	public String getDeviceName() {
		return deviceName;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getRevokedAt() {
		return revokedAt;
	}

	public void markUsed(Instant usedAt) {
		lastUsedAt = usedAt;
	}

	public void revoke(Instant revokedAt) {
		this.revokedAt = revokedAt;
	}

	public boolean isActiveAt(Instant instant) {
		return revokedAt == null && expiresAt.isAfter(instant);
	}
}

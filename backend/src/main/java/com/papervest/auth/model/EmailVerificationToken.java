package com.papervest.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "email_verification_tokens")
public class EmailVerificationToken {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(name = "token_hash", nullable = false, unique = true, length = 64)
	private String tokenHash;

	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	@Column(name = "consumed_at")
	private Instant consumedAt;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected EmailVerificationToken() {
	}

	public EmailVerificationToken(UUID userId, String tokenHash, Instant expiresAt) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.tokenHash = tokenHash;
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

	public Instant getConsumedAt() {
		return consumedAt;
	}

	public boolean isActiveAt(Instant instant) {
		return consumedAt == null && expiresAt.isAfter(instant);
	}

	public void consume(Instant consumedAt) {
		this.consumedAt = consumedAt;
	}
}

package com.papervest.user.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

	@Id
	private UUID id;

	@Column(nullable = false, unique = true)
	private String email;

	@Column(name = "password_hash", nullable = false)
	private String passwordHash;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Column(name = "email_verified_at")
	private Instant emailVerifiedAt;

	protected User() {
	}

	public User(String email, String passwordHash) {
		this.id = UUID.randomUUID();
		this.email = email;
		this.passwordHash = passwordHash;
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		if (id == null) {
			id = UUID.randomUUID();
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

	public String getEmail() {
		return email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getEmailVerifiedAt() {
		return emailVerifiedAt;
	}

	public boolean isEmailVerified() {
		return emailVerifiedAt != null;
	}

	public void changePasswordHash(String passwordHash) {
		this.passwordHash = passwordHash;
	}

	public void markEmailVerified(Instant verifiedAt) {
		if (emailVerifiedAt == null) {
			emailVerifiedAt = verifiedAt;
		}
	}
}

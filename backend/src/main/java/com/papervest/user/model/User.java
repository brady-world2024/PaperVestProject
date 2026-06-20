package com.papervest.user.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private UserRole role;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Column(name = "email_verified_at")
	private Instant emailVerifiedAt;

	protected User() {
	}

	public User(String email, String passwordHash) {
		this(email, passwordHash, UserRole.USER);
	}

	public User(String email, String passwordHash, UserRole role) {
		this.id = UUID.randomUUID();
		this.email = email;
		this.passwordHash = passwordHash;
		this.role = role == null ? UserRole.USER : role;
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

	public UserRole getRole() {
		return role;
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

	public void changeRole(UserRole nextRole) {
		role = nextRole == null ? UserRole.USER : nextRole;
	}
}

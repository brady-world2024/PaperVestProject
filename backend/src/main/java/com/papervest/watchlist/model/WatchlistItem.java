package com.papervest.watchlist.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "watchlist_items")
public class WatchlistItem {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(nullable = false, length = 16)
	private String symbol;

	@Column(name = "company_name", nullable = false)
	private String companyName;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected WatchlistItem() {
	}

	public WatchlistItem(UUID userId, String symbol, String companyName) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.symbol = symbol;
		this.companyName = companyName;
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

	public String getSymbol() {
		return symbol;
	}

	public String getCompanyName() {
		return companyName;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}

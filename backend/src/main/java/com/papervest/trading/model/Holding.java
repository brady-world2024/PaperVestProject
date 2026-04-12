package com.papervest.trading.model;

import com.papervest.common.util.MoneyUtils;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "holdings")
public class Holding {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(nullable = false, length = 16)
	private String symbol;

	@Column(name = "company_name", nullable = false)
	private String companyName;

	@Column(nullable = false, precision = 19, scale = 4)
	private BigDecimal quantity;

	@Column(name = "average_cost", nullable = false, precision = 19, scale = 4)
	private BigDecimal averageCost;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected Holding() {
	}

	public Holding(UUID userId, String symbol, String companyName, BigDecimal quantity, BigDecimal averageCost) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.symbol = symbol;
		this.companyName = companyName;
		this.quantity = MoneyUtils.scaleQuantity(quantity);
		this.averageCost = MoneyUtils.scalePrice(averageCost);
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

	public UUID getUserId() {
		return userId;
	}

	public String getSymbol() {
		return symbol;
	}

	public String getCompanyName() {
		return companyName;
	}

	public BigDecimal getQuantity() {
		return quantity;
	}

	public BigDecimal getAverageCost() {
		return averageCost;
	}

	public void applyBuy(BigDecimal purchasedQuantity, BigDecimal executedPrice, String resolvedCompanyName) {
		BigDecimal totalCost = averageCost.multiply(quantity).add(executedPrice.multiply(purchasedQuantity));
		BigDecimal newQuantity = MoneyUtils.scaleQuantity(quantity.add(purchasedQuantity));

		quantity = newQuantity;
		averageCost = totalCost.divide(newQuantity, MoneyUtils.PRICE_SCALE, RoundingMode.HALF_UP);
		companyName = resolvedCompanyName;
	}

	public void applySell(BigDecimal soldQuantity) {
		quantity = MoneyUtils.scaleQuantity(quantity.subtract(soldQuantity));
	}

	public boolean isClosed() {
		return quantity.compareTo(BigDecimal.ZERO) == 0;
	}
}

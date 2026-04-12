package com.papervest.common.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class MoneyUtils {

	public static final int MONEY_SCALE = 2;
	public static final int PRICE_SCALE = 4;
	public static final int QUANTITY_SCALE = 4;

	private MoneyUtils() {
	}

	public static BigDecimal scaleMoney(BigDecimal value) {
		return value.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
	}

	public static BigDecimal scalePrice(BigDecimal value) {
		return value.setScale(PRICE_SCALE, RoundingMode.HALF_UP);
	}

	public static BigDecimal scaleQuantity(BigDecimal value) {
		return value.setScale(QUANTITY_SCALE, RoundingMode.HALF_UP);
	}

	public static BigDecimal moneyProduct(BigDecimal left, BigDecimal right) {
		return scaleMoney(left.multiply(right));
	}

	public static BigDecimal percent(BigDecimal numerator, BigDecimal denominator) {
		if (denominator == null || denominator.compareTo(BigDecimal.ZERO) == 0) {
			return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
		}
		return numerator
				.divide(denominator, 6, RoundingMode.HALF_UP)
				.multiply(BigDecimal.valueOf(100))
				.setScale(2, RoundingMode.HALF_UP);
	}
}

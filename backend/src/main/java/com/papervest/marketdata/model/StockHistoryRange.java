package com.papervest.marketdata.model;

import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;
import java.util.Optional;

public enum StockHistoryRange {
	ONE_DAY("1D"),
	ONE_WEEK("1W"),
	ONE_MONTH("1M"),
	THREE_MONTHS("3M"),
	ONE_YEAR("1Y");

	private final String value;

	StockHistoryRange(String value) {
		this.value = value;
	}

	@JsonValue
	public String value() {
		return value;
	}

	public static Optional<StockHistoryRange> fromValue(String rawValue) {
		if (rawValue == null || rawValue.isBlank()) {
			return Optional.empty();
		}

		return Arrays.stream(values())
				.filter(range -> range.value.equalsIgnoreCase(rawValue.trim()))
				.findFirst();
	}
}

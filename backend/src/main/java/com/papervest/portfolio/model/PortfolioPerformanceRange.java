package com.papervest.portfolio.model;

import com.fasterxml.jackson.annotation.JsonValue;
import com.papervest.common.exception.BadRequestException;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

public enum PortfolioPerformanceRange {
	ONE_WEEK("1W") {
		@Override
		public Instant since(Clock clock) {
			return clock.instant().minus(7, ChronoUnit.DAYS);
		}
	},
	ONE_MONTH("1M") {
		@Override
		public Instant since(Clock clock) {
			return clock.instant().minus(30, ChronoUnit.DAYS);
		}
	},
	THREE_MONTHS("3M") {
		@Override
		public Instant since(Clock clock) {
			return clock.instant().minus(90, ChronoUnit.DAYS);
		}
	},
	ALL("ALL") {
		@Override
		public Instant since(Clock clock) {
			return null;
		}
	};

	private final String value;

	PortfolioPerformanceRange(String value) {
		this.value = value;
	}

	@JsonValue
	public String value() {
		return value;
	}

	public abstract Instant since(Clock clock);

	public static PortfolioPerformanceRange fromValue(String rawValue) {
		if (rawValue == null || rawValue.isBlank()) {
			return ONE_MONTH;
		}

		for (PortfolioPerformanceRange range : values()) {
			if (range.value.equalsIgnoreCase(rawValue.trim())) {
				return range;
			}
		}

		throw new BadRequestException(
				"INVALID_PORTFOLIO_PERFORMANCE_RANGE",
				"Portfolio performance range must be one of 1W, 1M, 3M, or ALL"
		);
	}
}

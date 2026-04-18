package com.papervest.marketdata.model;

import java.time.Instant;

public record MarketStatusSnapshot(
		String exchange,
		boolean open,
		String session,
		String timezone,
		Instant statusTimestamp
) {
}

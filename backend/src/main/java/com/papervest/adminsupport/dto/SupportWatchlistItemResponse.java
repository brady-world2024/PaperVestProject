package com.papervest.adminsupport.dto;

import java.time.Instant;

public record SupportWatchlistItemResponse(
		String symbol,
		String companyName,
		Instant addedAt
) {
}

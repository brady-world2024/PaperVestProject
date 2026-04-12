package com.papervest.watchlist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AddWatchlistItemRequest(
		@NotBlank
		@Pattern(regexp = "^[A-Za-z][A-Za-z.\\-]{0,15}$", message = "Symbol format is invalid")
		String symbol,
		@Size(max = 255) String companyName
) {
}

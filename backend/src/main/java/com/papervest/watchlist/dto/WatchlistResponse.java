package com.papervest.watchlist.dto;

import java.util.List;

public record WatchlistResponse(List<WatchlistItemResponse> items) {
}

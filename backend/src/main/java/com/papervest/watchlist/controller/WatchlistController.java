package com.papervest.watchlist.controller;

import com.papervest.common.security.AuthenticatedUser;
import com.papervest.watchlist.dto.AddWatchlistItemRequest;
import com.papervest.watchlist.dto.WatchlistItemResponse;
import com.papervest.watchlist.dto.WatchlistResponse;
import com.papervest.watchlist.service.WatchlistService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {

	private final WatchlistService watchlistService;

	public WatchlistController(WatchlistService watchlistService) {
		this.watchlistService = watchlistService;
	}

	@GetMapping
	public WatchlistResponse getWatchlist(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return watchlistService.getWatchlist(currentUser.userId());
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public WatchlistItemResponse addWatchlistItem(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody AddWatchlistItemRequest request
	) {
		return watchlistService.add(currentUser.userId(), request);
	}

	@DeleteMapping("/{symbol}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void removeWatchlistItem(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@PathVariable String symbol
	) {
		watchlistService.remove(currentUser.userId(), symbol);
	}
}

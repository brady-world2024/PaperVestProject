package com.papervest.watchlist.repository;

import com.papervest.watchlist.model.WatchlistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WatchlistItemRepository extends JpaRepository<WatchlistItem, UUID> {

	List<WatchlistItem> findByUserIdOrderByCreatedAtDesc(UUID userId);

	boolean existsByUserIdAndSymbol(UUID userId, String symbol);

	Optional<WatchlistItem> findByUserIdAndSymbol(UUID userId, String symbol);
}

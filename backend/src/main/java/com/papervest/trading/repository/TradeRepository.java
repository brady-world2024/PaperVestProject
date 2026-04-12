package com.papervest.trading.repository;

import com.papervest.trading.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TradeRepository extends JpaRepository<Trade, UUID> {

	List<Trade> findTop200ByUserIdOrderByExecutedAtDesc(UUID userId);

	Optional<Trade> findByUserIdAndIdempotencyKey(UUID userId, String idempotencyKey);

	Optional<Trade> findByExecutionKey(String executionKey);
}

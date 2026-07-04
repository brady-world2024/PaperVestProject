package com.papervest.portfolio.repository;

import com.papervest.portfolio.model.PortfolioSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PortfolioSnapshotRepository extends JpaRepository<PortfolioSnapshot, UUID> {

	List<PortfolioSnapshot> findByUserIdOrderByCreatedAtAsc(UUID userId);

	List<PortfolioSnapshot> findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(UUID userId, Instant createdAt);

	Optional<PortfolioSnapshot> findFirstByUserIdAndCreatedAtLessThanEqualOrderByCreatedAtDesc(UUID userId, Instant createdAt);
}

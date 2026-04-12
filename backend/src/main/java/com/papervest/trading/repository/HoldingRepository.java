package com.papervest.trading.repository;

import com.papervest.trading.model.Holding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HoldingRepository extends JpaRepository<Holding, UUID> {

	List<Holding> findByUserIdOrderBySymbolAsc(UUID userId);

	Optional<Holding> findByUserIdAndSymbol(UUID userId, String symbol);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select holding from Holding holding where holding.userId = :userId and holding.symbol = :symbol")
	Optional<Holding> findByUserIdAndSymbolForUpdate(UUID userId, String symbol);
}

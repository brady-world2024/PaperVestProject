package com.papervest.portfolio.repository;

import com.papervest.portfolio.model.DailyPerformanceSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DailyPerformanceSnapshotRepository extends JpaRepository<DailyPerformanceSnapshot, UUID> {

	Optional<DailyPerformanceSnapshot> findByUserIdAndPerformanceDate(UUID userId, LocalDate performanceDate);

	List<DailyPerformanceSnapshot> findByUserIdAndPerformanceDateBetweenOrderByPerformanceDateAsc(
			UUID userId,
			LocalDate from,
			LocalDate to
	);

	List<DailyPerformanceSnapshot> findByUserIdAndPerformanceDateLessThanEqualOrderByPerformanceDateAsc(
			UUID userId,
			LocalDate performanceDate
	);
}

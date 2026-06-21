package com.papervest.analytics.repository;

import com.papervest.analytics.model.ProductAnalyticsEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ProductAnalyticsEventRepository extends JpaRepository<ProductAnalyticsEvent, UUID> {

	List<ProductAnalyticsEvent> findByCreatedAtGreaterThanEqualOrderByCreatedAtAsc(Instant cutoff);
}

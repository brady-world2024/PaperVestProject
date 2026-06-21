package com.papervest.analytics.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.analytics.dto.ProductAnalyticsDailyActivityPointResponse;
import com.papervest.analytics.dto.ProductAnalyticsEventBreakdownResponse;
import com.papervest.analytics.dto.ProductAnalyticsFunnelResponse;
import com.papervest.analytics.dto.ProductAnalyticsOverviewResponse;
import com.papervest.analytics.dto.ProductAnalyticsSummaryResponse;
import com.papervest.analytics.dto.ProductAnalyticsTopPageResponse;
import com.papervest.analytics.dto.TrackProductAnalyticsEventRequest;
import com.papervest.analytics.model.ProductAnalyticsEvent;
import com.papervest.analytics.model.ProductAnalyticsEventName;
import com.papervest.analytics.model.ProductAnalyticsEventSource;
import com.papervest.analytics.repository.ProductAnalyticsEventRepository;
import com.papervest.common.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ProductAnalyticsService {

	private static final Logger log = LoggerFactory.getLogger(ProductAnalyticsService.class);

	private final ProductAnalyticsEventRepository repository;
	private final ObjectMapper objectMapper;
	private final Clock clock;

	public ProductAnalyticsService(
			ProductAnalyticsEventRepository repository,
			ObjectMapper objectMapper,
			Clock clock
	) {
		this.repository = repository;
		this.objectMapper = objectMapper;
		this.clock = clock;
	}

	@Transactional
	public void trackWebEvent(UUID userId, TrackProductAnalyticsEventRequest request) {
		if (!request.eventName().isWebTrackable()) {
			throw new BadRequestException(
					"ANALYTICS_EVENT_NOT_ALLOWED",
					"Only browser-level analytics events can be submitted through this endpoint"
			);
		}

		recordEvent(
				userId,
				ProductAnalyticsEventSource.WEB_APP,
				request.eventName(),
				normalizePath(request.path()),
				request.metadata()
		);
	}

	@Transactional
	public void trackDomainEvent(UUID userId, ProductAnalyticsEventName eventName, Map<String, Object> metadata) {
		recordEvent(userId, ProductAnalyticsEventSource.BACKEND_DOMAIN, eventName, null, metadata);
	}

	@Transactional(readOnly = true)
	public ProductAnalyticsOverviewResponse getOverview(int requestedWindowDays) {
		int windowDays = normalizeWindowDays(requestedWindowDays);
		Instant to = clock.instant();
		Instant from = to.minus(windowDays, ChronoUnit.DAYS);
		List<ProductAnalyticsEvent> events = repository.findByCreatedAtGreaterThanEqualOrderByCreatedAtAsc(from);

		Map<ProductAnalyticsEventName, Long> countsByEvent = new EnumMap<>(ProductAnalyticsEventName.class);
		Map<LocalDate, DailyAccumulator> dailyAccumulators = new LinkedHashMap<>();
		Map<String, Long> pageViewsByPath = new LinkedHashMap<>();
		Set<UUID> uniqueUsers = new LinkedHashSet<>();
		Set<UUID> pageViewUsers = new LinkedHashSet<>();
		Set<UUID> searchUsers = new LinkedHashSet<>();
		Set<UUID> watchlistUsers = new LinkedHashSet<>();
		Set<UUID> tradeUsers = new LinkedHashSet<>();
		Set<UUID> conditionalOrderUsers = new LinkedHashSet<>();

		for (ProductAnalyticsEvent event : events) {
			countsByEvent.merge(event.getEventName(), 1L, Long::sum);
			if (event.getUserId() != null) {
				uniqueUsers.add(event.getUserId());
			}

			LocalDate day = LocalDate.ofInstant(event.getCreatedAt(), ZoneOffset.UTC);
			DailyAccumulator daily = dailyAccumulators.computeIfAbsent(day, DailyAccumulator::new);
			daily.addEvent(event);

			if (event.getEventName() == ProductAnalyticsEventName.PAGE_VIEWED) {
				if (event.getPath() != null && !event.getPath().isBlank()) {
					pageViewsByPath.merge(event.getPath(), 1L, Long::sum);
				}
				addUser(event.getUserId(), pageViewUsers);
			}
			if (event.getEventName() == ProductAnalyticsEventName.STOCK_SEARCH_PERFORMED) {
				addUser(event.getUserId(), searchUsers);
			}
			if (event.getEventName() == ProductAnalyticsEventName.WATCHLIST_ITEM_ADDED
					|| event.getEventName() == ProductAnalyticsEventName.WATCHLIST_ITEM_REMOVED) {
				addUser(event.getUserId(), watchlistUsers);
			}
			if (event.getEventName() == ProductAnalyticsEventName.TRADE_EXECUTED) {
				addUser(event.getUserId(), tradeUsers);
			}
			if (event.getEventName() == ProductAnalyticsEventName.CONDITIONAL_ORDER_CREATED
					|| event.getEventName() == ProductAnalyticsEventName.CONDITIONAL_ORDER_CANCELLED) {
				addUser(event.getUserId(), conditionalOrderUsers);
			}
		}

		ProductAnalyticsSummaryResponse summary = new ProductAnalyticsSummaryResponse(
				events.size(),
				uniqueUsers.size(),
				countFor(countsByEvent, ProductAnalyticsEventName.PAGE_VIEWED),
				countFor(countsByEvent, ProductAnalyticsEventName.STOCK_SEARCH_PERFORMED),
				countFor(countsByEvent, ProductAnalyticsEventName.USER_REGISTERED),
				countFor(countsByEvent, ProductAnalyticsEventName.USER_LOGGED_IN),
				countFor(countsByEvent, ProductAnalyticsEventName.TRADE_EXECUTED),
				countFor(countsByEvent, ProductAnalyticsEventName.CONDITIONAL_ORDER_CREATED),
				countFor(countsByEvent, ProductAnalyticsEventName.CONDITIONAL_ORDER_CANCELLED),
				countFor(countsByEvent, ProductAnalyticsEventName.WATCHLIST_ITEM_ADDED),
				countFor(countsByEvent, ProductAnalyticsEventName.WATCHLIST_ITEM_REMOVED)
		);

		List<ProductAnalyticsDailyActivityPointResponse> dailyActivity = dailyAccumulators.values()
				.stream()
				.sorted(Comparator.comparing(DailyAccumulator::day))
				.map(DailyAccumulator::toResponse)
				.toList();

		List<ProductAnalyticsTopPageResponse> topPages = pageViewsByPath.entrySet()
				.stream()
				.sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
				.limit(8)
				.map(entry -> new ProductAnalyticsTopPageResponse(entry.getKey(), entry.getValue()))
				.toList();

		List<ProductAnalyticsEventBreakdownResponse> eventBreakdown = countsByEvent.entrySet()
				.stream()
				.sorted(Map.Entry.<ProductAnalyticsEventName, Long>comparingByValue().reversed()
						.thenComparing(entry -> entry.getKey().name()))
				.map(entry -> new ProductAnalyticsEventBreakdownResponse(entry.getKey(), entry.getValue()))
				.toList();

		ProductAnalyticsFunnelResponse funnel = new ProductAnalyticsFunnelResponse(
				uniqueUsers.size(),
				pageViewUsers.size(),
				searchUsers.size(),
				watchlistUsers.size(),
				tradeUsers.size(),
				conditionalOrderUsers.size()
		);

		return new ProductAnalyticsOverviewResponse(
				windowDays,
				from,
				to,
				summary,
				dailyActivity,
				topPages,
				eventBreakdown,
				funnel
		);
	}

	private void recordEvent(
			UUID userId,
			ProductAnalyticsEventSource source,
			ProductAnalyticsEventName eventName,
			String path,
			Map<String, Object> metadata
	) {
		repository.save(new ProductAnalyticsEvent(
				userId,
				source,
				eventName,
				path,
				serializeMetadata(metadata)
		));
		log.info("Product analytics event recorded userId={} source={} event={} path={}", userId, source, eventName, path);
	}

	private String serializeMetadata(Map<String, Object> metadata) {
		if (metadata == null || metadata.isEmpty()) {
			return null;
		}
		try {
			return objectMapper.writeValueAsString(metadata);
		}
		catch (JsonProcessingException ex) {
			throw new IllegalStateException("Unable to serialize product analytics metadata", ex);
		}
	}

	private int normalizeWindowDays(int requestedWindowDays) {
		return switch (requestedWindowDays) {
			case 7, 30, 90 -> requestedWindowDays;
			default -> throw new BadRequestException(
					"INVALID_ANALYTICS_WINDOW",
					"Analytics window must be 7, 30, or 90 days"
			);
		};
	}

	private String normalizePath(String path) {
		if (path == null || path.isBlank()) {
			return null;
		}
		String trimmed = path.trim();
		return trimmed.length() > 255 ? trimmed.substring(0, 255) : trimmed;
	}

	private void addUser(UUID userId, Set<UUID> target) {
		if (userId != null) {
			target.add(userId);
		}
	}

	private long countFor(Map<ProductAnalyticsEventName, Long> countsByEvent, ProductAnalyticsEventName eventName) {
		return countsByEvent.getOrDefault(eventName, 0L);
	}

	private static final class DailyAccumulator {
		private final LocalDate day;
		private long totalEvents;
		private final Set<UUID> uniqueUsers = new LinkedHashSet<>();
		private final Map<ProductAnalyticsEventName, Long> countsByEvent = new EnumMap<>(ProductAnalyticsEventName.class);

		private DailyAccumulator(LocalDate day) {
			this.day = day;
		}

		private void addEvent(ProductAnalyticsEvent event) {
			totalEvents += 1;
			if (event.getUserId() != null) {
				uniqueUsers.add(event.getUserId());
			}
			countsByEvent.merge(event.getEventName(), 1L, Long::sum);
		}

		private LocalDate day() {
			return day;
		}

		private ProductAnalyticsDailyActivityPointResponse toResponse() {
			return new ProductAnalyticsDailyActivityPointResponse(
					day,
					totalEvents,
					uniqueUsers.size(),
					countsByEvent.getOrDefault(ProductAnalyticsEventName.PAGE_VIEWED, 0L),
					countsByEvent.getOrDefault(ProductAnalyticsEventName.STOCK_SEARCH_PERFORMED, 0L),
					countsByEvent.getOrDefault(ProductAnalyticsEventName.USER_REGISTERED, 0L),
					countsByEvent.getOrDefault(ProductAnalyticsEventName.USER_LOGGED_IN, 0L),
					countsByEvent.getOrDefault(ProductAnalyticsEventName.TRADE_EXECUTED, 0L),
					countsByEvent.getOrDefault(ProductAnalyticsEventName.CONDITIONAL_ORDER_CREATED, 0L)
			);
		}
	}
}

package com.papervest.portfolio.scheduler;

import com.papervest.portfolio.service.DailyPerformanceSnapshotService;
import com.papervest.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

@Component
@ConditionalOnProperty(value = "app.portfolio.performance.scheduler.enabled", havingValue = "true", matchIfMissing = true)
public class DailyPerformanceSnapshotScheduler {

	private static final Logger log = LoggerFactory.getLogger(DailyPerformanceSnapshotScheduler.class);

	private final UserRepository userRepository;
	private final DailyPerformanceSnapshotService dailyPerformanceSnapshotService;
	private final Clock clock;
	private final ZoneId schedulerZone;

	public DailyPerformanceSnapshotScheduler(
			UserRepository userRepository,
			DailyPerformanceSnapshotService dailyPerformanceSnapshotService,
			Clock clock,
			@Value("${app.portfolio.performance.scheduler.zone:America/New_York}") String schedulerZone
	) {
		this.userRepository = userRepository;
		this.dailyPerformanceSnapshotService = dailyPerformanceSnapshotService;
		this.clock = clock;
		this.schedulerZone = ZoneId.of(schedulerZone);
	}

	@Scheduled(cron = "${app.portfolio.performance.scheduler.cron:0 10 22 * * MON-FRI}", zone = "${app.portfolio.performance.scheduler.zone:America/New_York}")
	public void recordDailySnapshots() {
		LocalDate performanceDate = LocalDate.now(clock.withZone(schedulerZone));
		for (UUID userId : userRepository.findAllIds()) {
			recordDailySnapshot(userId, performanceDate);
		}
	}

	private void recordDailySnapshot(UUID userId, LocalDate performanceDate) {
		try {
			dailyPerformanceSnapshotService.recordDailySnapshot(userId, performanceDate);
		} catch (RuntimeException exception) {
			log.warn("Daily performance snapshot failed for userId={} performanceDate={}", userId, performanceDate, exception);
		}
	}
}

package com.papervest.portfolio.scheduler;

import com.papervest.portfolio.service.DailyPerformanceSnapshotService;
import com.papervest.user.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DailyPerformanceSnapshotSchedulerTest {

	private final UserRepository userRepository = mock(UserRepository.class);
	private final DailyPerformanceSnapshotService dailyPerformanceSnapshotService = mock(DailyPerformanceSnapshotService.class);
	private final Clock clock = Clock.fixed(Instant.parse("2026-07-05T02:00:00Z"), ZoneOffset.UTC);

	@Test
	void recordsDailySnapshotForEveryUser() {
		UUID firstUserId = UUID.randomUUID();
		UUID secondUserId = UUID.randomUUID();
		when(userRepository.findAllIds()).thenReturn(List.of(firstUserId, secondUserId));
		DailyPerformanceSnapshotScheduler scheduler = new DailyPerformanceSnapshotScheduler(
				userRepository,
				dailyPerformanceSnapshotService,
				clock,
				"America/New_York"
		);

		scheduler.recordDailySnapshots();

		LocalDate expectedDate = LocalDate.parse("2026-07-04");
		verify(dailyPerformanceSnapshotService).recordDailySnapshot(firstUserId, expectedDate);
		verify(dailyPerformanceSnapshotService).recordDailySnapshot(secondUserId, expectedDate);
	}

	@Test
	void continuesWhenOneUserSnapshotFails() {
		UUID failingUserId = UUID.randomUUID();
		UUID successfulUserId = UUID.randomUUID();
		when(userRepository.findAllIds()).thenReturn(List.of(failingUserId, successfulUserId));
		doThrow(new IllegalStateException("valuation unavailable"))
				.when(dailyPerformanceSnapshotService)
				.recordDailySnapshot(failingUserId, LocalDate.parse("2026-07-04"));
		DailyPerformanceSnapshotScheduler scheduler = new DailyPerformanceSnapshotScheduler(
				userRepository,
				dailyPerformanceSnapshotService,
				clock,
				"America/New_York"
		);

		assertThatCode(scheduler::recordDailySnapshots).doesNotThrowAnyException();

		verify(dailyPerformanceSnapshotService).recordDailySnapshot(successfulUserId, LocalDate.parse("2026-07-04"));
	}
}

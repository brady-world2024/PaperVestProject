package com.papervest.orders.service;

import com.papervest.orders.model.OrderTimeInForce;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Component
public class OrderExpirationPolicy {

	private static final ZoneId NEW_YORK = ZoneId.of("America/New_York");
	private static final LocalTime REGULAR_SESSION_CLOSE = LocalTime.of(16, 0);

	public Instant expiresAtFor(OrderTimeInForce timeInForce, Instant createdAt) {
		if (timeInForce != OrderTimeInForce.DAY) {
			return null;
		}

		ZonedDateTime localCreatedAt = createdAt.atZone(NEW_YORK);
		LocalDate expirationDate = localCreatedAt.toLocalDate();
		ZonedDateTime sameDayClose = expirationDate.atTime(REGULAR_SESSION_CLOSE).atZone(NEW_YORK);

		if (!isWeekday(expirationDate) || !localCreatedAt.isBefore(sameDayClose)) {
			expirationDate = nextWeekday(expirationDate.plusDays(1));
		}

		return expirationDate.atTime(REGULAR_SESSION_CLOSE).atZone(NEW_YORK).toInstant();
	}

	private LocalDate nextWeekday(LocalDate date) {
		LocalDate candidate = date;
		while (!isWeekday(candidate)) {
			candidate = candidate.plusDays(1);
		}
		return candidate;
	}

	private boolean isWeekday(LocalDate date) {
		DayOfWeek day = date.getDayOfWeek();
		return day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY;
	}
}

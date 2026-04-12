package com.papervest.common.api;

import java.time.Instant;
import java.util.List;

public record ApiErrorResponse(
		String code,
		String message,
		String path,
		String requestId,
		Instant timestamp,
		List<FieldValidationError> fieldErrors
) {
	public record FieldValidationError(String field, String message) {
	}
}

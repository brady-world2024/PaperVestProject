package com.papervest.common.exception;

public class RateLimitExceededException extends ExternalServiceException {

	public RateLimitExceededException(String message) {
		super("MARKETDATA_RATE_LIMIT", message);
	}
}

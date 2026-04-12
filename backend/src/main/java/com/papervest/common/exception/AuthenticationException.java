package com.papervest.common.exception;

import org.springframework.http.HttpStatus;

public class AuthenticationException extends ApiException {

	public AuthenticationException(String message) {
		super(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED", message);
	}
}

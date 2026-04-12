package com.papervest.common.exception;

import org.springframework.http.HttpStatus;

public class InvalidTradeException extends ApiException {

	public InvalidTradeException(String code, String message) {
		super(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
	}
}

package com.papervest.common.web;

import com.papervest.common.api.ApiErrorResponse;
import com.papervest.common.exception.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorResponse> handleValidationFailure(MethodArgumentNotValidException ex, HttpServletRequest request) {
		List<ApiErrorResponse.FieldValidationError> fieldErrors = ex.getBindingResult()
				.getFieldErrors()
				.stream()
				.map(this::toFieldError)
				.toList();
		log.warn(
				"Validation failed method={} path={} requestId={} userId={} fieldErrorCount={}",
				request.getMethod(),
				request.getRequestURI(),
				MDC.get(RequestIdFilter.REQUEST_ID_KEY),
				MDC.get(RequestIdFilter.USER_ID_KEY),
				fieldErrors.size()
		);

		return buildResponse(
				HttpStatus.BAD_REQUEST,
				"VALIDATION_FAILED",
				"One or more fields failed validation",
				fieldErrors,
				request
		);
	}

	@ExceptionHandler(ConstraintViolationException.class)
	public ResponseEntity<ApiErrorResponse> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
		List<ApiErrorResponse.FieldValidationError> fieldErrors = ex.getConstraintViolations()
				.stream()
				.map(violation -> new ApiErrorResponse.FieldValidationError(
						violation.getPropertyPath().toString(),
						violation.getMessage()
				))
				.toList();
		log.warn(
				"Constraint violation method={} path={} requestId={} userId={} fieldErrorCount={}",
				request.getMethod(),
				request.getRequestURI(),
				MDC.get(RequestIdFilter.REQUEST_ID_KEY),
				MDC.get(RequestIdFilter.USER_ID_KEY),
				fieldErrors.size()
		);

		return buildResponse(
				HttpStatus.BAD_REQUEST,
				"VALIDATION_FAILED",
				"One or more fields failed validation",
				fieldErrors,
				request
		);
	}

	@ExceptionHandler(ApiException.class)
	public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
		if (ex.status().is5xxServerError()) {
			log.error(
					"API exception method={} path={} status={} code={} requestId={} userId={} message={}",
					request.getMethod(),
					request.getRequestURI(),
					ex.status().value(),
					ex.code(),
					MDC.get(RequestIdFilter.REQUEST_ID_KEY),
					MDC.get(RequestIdFilter.USER_ID_KEY),
					ex.getMessage()
			);
		}
		else {
			log.debug(
					"API exception handled method={} path={} status={} code={} requestId={} userId={} message={}",
					request.getMethod(),
					request.getRequestURI(),
					ex.status().value(),
					ex.code(),
					MDC.get(RequestIdFilter.REQUEST_ID_KEY),
					MDC.get(RequestIdFilter.USER_ID_KEY),
					ex.getMessage()
			);
		}
		return buildResponse(ex.status(), ex.code(), ex.getMessage(), List.of(), request);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiErrorResponse> handleUnhandledException(Exception ex, HttpServletRequest request) {
		log.error(
				"Unhandled exception method={} path={} requestId={} userId={} type={} message={}",
				request.getMethod(),
				request.getRequestURI(),
				MDC.get(RequestIdFilter.REQUEST_ID_KEY),
				MDC.get(RequestIdFilter.USER_ID_KEY),
				ex.getClass().getName(),
				ex.getMessage(),
				ex
		);
		return buildResponse(
				HttpStatus.INTERNAL_SERVER_ERROR,
				"INTERNAL_SERVER_ERROR",
				"Something went wrong while processing the request",
				List.of(),
				request
		);
	}

	private ResponseEntity<ApiErrorResponse> buildResponse(
			HttpStatus status,
			String code,
			String message,
			List<ApiErrorResponse.FieldValidationError> fieldErrors,
			HttpServletRequest request
	) {
		ApiErrorResponse response = new ApiErrorResponse(
				code,
				message,
				request.getRequestURI(),
				MDC.get(RequestIdFilter.REQUEST_ID_KEY),
				Instant.now(),
				fieldErrors
		);
		return ResponseEntity.status(status).body(response);
	}

	private ApiErrorResponse.FieldValidationError toFieldError(FieldError fieldError) {
		return new ApiErrorResponse.FieldValidationError(fieldError.getField(), fieldError.getDefaultMessage());
	}
}

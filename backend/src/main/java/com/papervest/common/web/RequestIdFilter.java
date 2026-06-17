package com.papervest.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

	public static final String REQUEST_ID_KEY = "requestId";
	public static final String USER_ID_KEY = "userId";
	public static final String HTTP_METHOD_KEY = "httpMethod";
	public static final String REQUEST_PATH_KEY = "requestPath";
	public static final String REQUEST_ID_HEADER = "X-Request-Id";
	public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
	private static final int MAX_REQUEST_ID_LENGTH = 120;
	private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		String requestId = resolveRequestId(request);

		long startedAt = System.currentTimeMillis();
		MDC.put(REQUEST_ID_KEY, requestId);
		MDC.put(HTTP_METHOD_KEY, request.getMethod());
		MDC.put(REQUEST_PATH_KEY, request.getRequestURI());
		request.setAttribute(REQUEST_ID_KEY, requestId);
		response.setHeader(REQUEST_ID_HEADER, requestId);
		response.setHeader(CORRELATION_ID_HEADER, requestId);

		try {
			filterChain.doFilter(request, response);
		}
		finally {
			long durationMs = System.currentTimeMillis() - startedAt;
			if (isHealthProbe(request)) {
				log.debug(
						"HTTP request completed method={} path={} status={} durationMs={}",
						request.getMethod(),
						request.getRequestURI(),
						response.getStatus(),
						durationMs
				);
			}
			else {
				log.info(
						"HTTP request completed method={} path={} status={} durationMs={}",
						request.getMethod(),
						request.getRequestURI(),
						response.getStatus(),
						durationMs
				);
			}
			clearLoggingContext();
		}
	}

	private String resolveRequestId(HttpServletRequest request) {
		for (String headerName : List.of(REQUEST_ID_HEADER, CORRELATION_ID_HEADER)) {
			String requestId = sanitizeRequestId(request.getHeader(headerName));
			if (requestId != null) {
				return requestId;
			}
		}
		return UUID.randomUUID().toString();
	}

	private String sanitizeRequestId(String rawValue) {
		if (rawValue == null || rawValue.isBlank()) {
			return null;
		}

		String trimmed = rawValue.trim();
		if (trimmed.length() > MAX_REQUEST_ID_LENGTH) {
			trimmed = trimmed.substring(0, MAX_REQUEST_ID_LENGTH);
		}

		for (int index = 0; index < trimmed.length(); index++) {
			char current = trimmed.charAt(index);
			if (!(Character.isLetterOrDigit(current) || current == '-' || current == '_' || current == '.' || current == ':')) {
				return null;
			}
		}
		return trimmed;
	}

	private boolean isHealthProbe(HttpServletRequest request) {
		String requestUri = request.getRequestURI();
		return "/actuator/health".equals(requestUri)
				|| requestUri.startsWith("/actuator/health/")
				|| "/livez".equals(requestUri)
				|| "/readyz".equals(requestUri);
	}

	private void clearLoggingContext() {
		MDC.remove(REQUEST_ID_KEY);
		MDC.remove(USER_ID_KEY);
		MDC.remove(HTTP_METHOD_KEY);
		MDC.remove(REQUEST_PATH_KEY);
	}
}

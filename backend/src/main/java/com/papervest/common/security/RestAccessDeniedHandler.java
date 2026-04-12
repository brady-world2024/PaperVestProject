package com.papervest.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.web.RequestIdFilter;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

	private static final Logger log = LoggerFactory.getLogger(RestAccessDeniedHandler.class);
	private final ObjectMapper objectMapper;

	public RestAccessDeniedHandler(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public void handle(
			HttpServletRequest request,
			HttpServletResponse response,
			AccessDeniedException accessDeniedException
	) throws IOException, ServletException {
		log.warn(
				"Access denied method={} path={} requestId={} userId={}",
				request.getMethod(),
				request.getRequestURI(),
				MDC.get(RequestIdFilter.REQUEST_ID_KEY),
				MDC.get(RequestIdFilter.USER_ID_KEY)
		);
		writeError(response, request, HttpStatus.FORBIDDEN, "ACCESS_DENIED", "You do not have access to this resource");
	}

	private void writeError(
			HttpServletResponse response,
			HttpServletRequest request,
			HttpStatus status,
			String code,
			String message
	) throws IOException {
		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(response.getOutputStream(), buildErrorBody(request, code, message));
	}

	private Map<String, Object> buildErrorBody(HttpServletRequest request, String code, String message) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("code", code);
		body.put("message", message);
		body.put("path", request.getRequestURI());
		body.put("requestId", MDC.get(RequestIdFilter.REQUEST_ID_KEY));
		body.put("timestamp", Instant.now().toString());
		body.put("fieldErrors", List.of());
		return body;
	}
}

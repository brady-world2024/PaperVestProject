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
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

	private static final Logger log = LoggerFactory.getLogger(RestAuthenticationEntryPoint.class);
	private final ObjectMapper objectMapper;

	public RestAuthenticationEntryPoint(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public void commence(
			HttpServletRequest request,
			HttpServletResponse response,
			AuthenticationException authException
	) throws IOException, ServletException {
		if ("/api/auth/session".equals(request.getRequestURI())) {
			log.info(
					"Session validation rejected method={} path={} requestId={} reason={}",
					request.getMethod(),
					request.getRequestURI(),
					MDC.get(RequestIdFilter.REQUEST_ID_KEY),
					authException.getMessage()
			);
		}
		else {
			log.debug(
					"Authentication required method={} path={} requestId={}",
					request.getMethod(),
					request.getRequestURI(),
					MDC.get(RequestIdFilter.REQUEST_ID_KEY)
			);
		}
		response.setStatus(HttpStatus.UNAUTHORIZED.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(response.getOutputStream(), buildErrorBody(request));
	}

	private Map<String, Object> buildErrorBody(HttpServletRequest request) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("code", "AUTHENTICATION_REQUIRED");
		body.put("message", "Authentication is required to access this resource");
		body.put("path", request.getRequestURI());
		body.put("requestId", MDC.get(RequestIdFilter.REQUEST_ID_KEY));
		body.put("timestamp", Instant.now().toString());
		body.put("fieldErrors", List.of());
		return body;
	}
}

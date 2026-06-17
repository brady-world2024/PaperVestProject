package com.papervest.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.config.AppSecurityProperties;
import com.papervest.common.web.RequestIdFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

	private static final Logger log = LoggerFactory.getLogger(AuthRateLimitFilter.class);

	private final ObjectMapper objectMapper;
	private final AppSecurityProperties properties;
	private final Clock clock;
	private final Map<String, AttemptWindow> windows = new ConcurrentHashMap<>();

	public AuthRateLimitFilter(ObjectMapper objectMapper, AppSecurityProperties properties, Clock clock) {
		this.objectMapper = objectMapper;
		this.properties = properties;
		this.clock = clock;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		RateLimitRule rule = resolveRule(request);
		if (rule == null || !properties.authRateLimit().enabled()) {
			filterChain.doFilter(request, response);
			return;
		}

		Instant now = clock.instant();
		String clientFingerprint = resolveClientFingerprint(request);
		String bucketKey = rule.path() + "::" + clientFingerprint;
		RateLimitDecision decision = windows
				.computeIfAbsent(bucketKey, ignored -> new AttemptWindow())
				.checkAndRecord(now, properties.authRateLimit().window(), rule.maxAttempts());

		if (!decision.allowed()) {
			log.warn(
					"Auth rate limit triggered method={} path={} requestId={} clientFingerprint={} retryAfterSeconds={}",
					request.getMethod(),
					request.getRequestURI(),
					MDC.get(RequestIdFilter.REQUEST_ID_KEY),
					clientFingerprint,
					decision.retryAfterSeconds()
			);
			writeRateLimited(response, request, decision.retryAfterSeconds(), rule.message());
			return;
		}

		filterChain.doFilter(request, response);
	}

	private RateLimitRule resolveRule(HttpServletRequest request) {
		if (!HttpMethod.POST.matches(request.getMethod())) {
			return null;
		}

		AppSecurityProperties.AuthRateLimitProperties rateLimit = properties.authRateLimit();
		return switch (request.getRequestURI()) {
			case "/api/auth/login" -> new RateLimitRule("/api/auth/login", rateLimit.loginMaxAttempts(), "Too many login attempts. Try again later.");
			case "/api/auth/register" -> new RateLimitRule("/api/auth/register", rateLimit.registerMaxAttempts(), "Too many registration attempts. Try again later.");
			case "/api/auth/password-reset/request" -> new RateLimitRule("/api/auth/password-reset/request", rateLimit.passwordResetRequestMaxAttempts(), "Too many password reset requests. Try again later.");
			case "/api/auth/password-reset/confirm" -> new RateLimitRule("/api/auth/password-reset/confirm", rateLimit.passwordResetConfirmMaxAttempts(), "Too many password reset attempts. Try again later.");
			case "/api/auth/email-verification/confirm" -> new RateLimitRule("/api/auth/email-verification/confirm", rateLimit.emailVerificationConfirmMaxAttempts(), "Too many email verification attempts. Try again later.");
			default -> null;
		};
	}

	private String resolveClientFingerprint(HttpServletRequest request) {
		String forwardedFor = request.getHeader("X-Forwarded-For");
		if (forwardedFor != null && !forwardedFor.isBlank()) {
			String first = forwardedFor.split(",")[0].trim();
			if (!first.isBlank()) {
				return first;
			}
		}

		String remoteAddress = request.getRemoteAddr();
		return remoteAddress == null || remoteAddress.isBlank() ? "unknown" : remoteAddress.trim();
	}

	private void writeRateLimited(
			HttpServletResponse response,
			HttpServletRequest request,
			long retryAfterSeconds,
			String message
	) throws IOException {
		response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.setHeader("Retry-After", Long.toString(retryAfterSeconds));
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("code", "RATE_LIMITED");
		body.put("message", message);
		body.put("path", request.getRequestURI());
		body.put("requestId", MDC.get(RequestIdFilter.REQUEST_ID_KEY));
		body.put("timestamp", clock.instant().toString());
		body.put("fieldErrors", List.of());
		objectMapper.writeValue(
				response.getOutputStream(),
				body
		);
	}

	private record RateLimitRule(String path, int maxAttempts, String message) {
	}

	private record RateLimitDecision(boolean allowed, long retryAfterSeconds) {
	}

	private static final class AttemptWindow {

		private final ArrayDeque<Instant> attempts = new ArrayDeque<>();

		synchronized RateLimitDecision checkAndRecord(Instant now, Duration window, int maxAttempts) {
			Instant threshold = now.minus(window);
			while (!attempts.isEmpty() && !attempts.peekFirst().isAfter(threshold)) {
				attempts.removeFirst();
			}

			if (attempts.size() >= maxAttempts) {
				Instant oldest = Objects.requireNonNull(attempts.peekFirst());
				long retryAfterSeconds = Math.max(1, Duration.between(now, oldest.plus(window)).toSeconds());
				return new RateLimitDecision(false, retryAfterSeconds);
			}

			attempts.addLast(now);
			return new RateLimitDecision(true, 0);
		}
	}
}

package com.papervest.common.security;

import com.papervest.auth.service.AuthCookieService;
import com.papervest.common.exception.AuthenticationException;
import com.papervest.common.web.RequestIdFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
	private final JwtService jwtService;
	private final AuthCookieService authCookieService;

	public JwtAuthenticationFilter(JwtService jwtService, AuthCookieService authCookieService) {
		this.jwtService = jwtService;
		this.authCookieService = authCookieService;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		String authorizationHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
		String token = null;
		String transport = null;

		if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
			token = authorizationHeader.substring("Bearer ".length()).trim();
			transport = "bearer";
		}

		if (token == null || token.isBlank()) {
			token = authCookieService.resolveAccessToken(request);
			if (token != null && !token.isBlank()) {
				transport = "cookie";
			}
		}

		if (token == null || token.isBlank()) {
			filterChain.doFilter(request, response);
			return;
		}

		try {
			AuthenticatedUser authenticatedUser = jwtService.parseAccessToken(token);
			MDC.put(RequestIdFilter.USER_ID_KEY, authenticatedUser.userId().toString());
			UsernamePasswordAuthenticationToken authentication =
					UsernamePasswordAuthenticationToken.authenticated(
							authenticatedUser,
							null,
							AuthorityUtils.NO_AUTHORITIES
					);
			SecurityContextHolder.getContext().setAuthentication(authentication);
			filterChain.doFilter(request, response);
		}
		catch (AuthenticationException ex) {
			SecurityContextHolder.clearContext();
			MDC.remove(RequestIdFilter.USER_ID_KEY);
			log.warn(
					"JWT authentication failed path={} transport={} reason={}",
					request.getRequestURI(),
					transport == null ? "unknown" : transport,
					ex.getMessage()
			);
			filterChain.doFilter(request, response);
		}
	}
}

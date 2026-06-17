package com.papervest.common.config;

import com.papervest.common.security.CsrfCookieFilter;
import com.papervest.common.security.JwtAuthenticationFilter;
import com.papervest.common.security.RestAccessDeniedHandler;
import com.papervest.common.security.RestAuthenticationEntryPoint;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.function.Supplier;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			JwtAuthenticationFilter jwtAuthenticationFilter,
			CsrfCookieFilter csrfCookieFilter,
			RestAuthenticationEntryPoint authenticationEntryPoint,
			RestAccessDeniedHandler accessDeniedHandler
	) throws Exception {
		CookieCsrfTokenRepository csrfTokenRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();

		return http
				.csrf(csrf -> csrf
						.csrfTokenRepository(csrfTokenRepository)
						.csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
						.requireCsrfProtectionMatcher(this::requiresCsrfProtection)
				)
				.cors(Customizer.withDefaults())
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint(authenticationEntryPoint)
						.accessDeniedHandler(accessDeniedHandler)
				)
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers("/actuator/health").permitAll()
						.requestMatchers("/api/test-support/**").permitAll()
						.requestMatchers(
								HttpMethod.POST,
								"/api/auth/register",
								"/api/auth/login",
								"/api/auth/refresh",
								"/api/auth/logout",
								"/api/auth/password-reset/request",
								"/api/auth/password-reset/confirm",
								"/api/auth/email-verification/confirm"
						).permitAll()
						.requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.anyRequest().authenticated()
				)
				.addFilterAfter(csrfCookieFilter, CsrfFilter.class)
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
				.build();
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(AppSecurityProperties properties) {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(properties.allowedOrigins().stream().map(String::trim).toList());
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of(
				"Authorization",
				"Content-Type",
				"X-Idempotency-Key",
				"X-Request-Id",
				"X-Correlation-Id",
				"X-XSRF-TOKEN"
		));
		configuration.setExposedHeaders(List.of("X-Request-Id", "X-Correlation-Id"));
		configuration.setAllowCredentials(true);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}

	private boolean requiresCsrfProtection(HttpServletRequest request) {
		if (HttpMethod.GET.matches(request.getMethod())
				|| HttpMethod.HEAD.matches(request.getMethod())
				|| HttpMethod.OPTIONS.matches(request.getMethod())
				|| HttpMethod.TRACE.matches(request.getMethod())) {
			return false;
		}

		if (request.getHeader(HttpHeaders.AUTHORIZATION) != null) {
			return false;
		}

		String origin = request.getHeader(HttpHeaders.ORIGIN);
		return origin != null && !origin.isBlank();
	}

	private static final class SpaCsrfTokenRequestHandler implements CsrfTokenRequestHandler {

		private final CsrfTokenRequestHandler plain = new CsrfTokenRequestAttributeHandler();
		private final CsrfTokenRequestHandler xor = new XorCsrfTokenRequestAttributeHandler();

		@Override
		public void handle(HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response, Supplier<CsrfToken> csrfToken) {
			xor.handle(request, response, csrfToken);
		}

		@Override
		public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken csrfToken) {
			String headerValue = request.getHeader(csrfToken.getHeaderName());
			if (StringUtils.hasText(headerValue)) {
				return plain.resolveCsrfTokenValue(request, csrfToken);
			}

			return xor.resolveCsrfTokenValue(request, csrfToken);
		}
	}
}

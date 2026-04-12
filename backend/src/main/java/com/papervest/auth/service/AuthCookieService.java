package com.papervest.auth.service;

import com.papervest.auth.dto.AuthResponse;
import com.papervest.common.config.AppSecurityProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class AuthCookieService {

	private final AppSecurityProperties properties;

	public AuthCookieService(AppSecurityProperties properties) {
		this.properties = properties;
	}

	public void writeSessionCookies(HttpServletResponse response, AuthResponse authResponse) {
		AppSecurityProperties.AuthCookieProperties cookieProperties = properties.authCookie();
		addCookie(
				response,
				cookieProperties.accessTokenName(),
				authResponse.accessToken(),
				properties.accessTokenTtl(),
				cookieProperties.accessTokenPath()
		);
		addCookie(
				response,
				cookieProperties.refreshTokenName(),
				authResponse.refreshToken(),
				properties.refreshTokenTtl(),
				cookieProperties.refreshTokenPath()
		);
	}

	public void clearSessionCookies(HttpServletResponse response) {
		AppSecurityProperties.AuthCookieProperties cookieProperties = properties.authCookie();
		addCookie(response, cookieProperties.accessTokenName(), "", Duration.ZERO, cookieProperties.accessTokenPath());
		addCookie(response, cookieProperties.refreshTokenName(), "", Duration.ZERO, cookieProperties.refreshTokenPath());
	}

	public String resolveRefreshToken(HttpServletRequest request, String requestToken) {
		if (requestToken != null && !requestToken.isBlank()) {
			return requestToken.trim();
		}

		return readCookie(request, properties.authCookie().refreshTokenName());
	}

	public String resolveAccessToken(HttpServletRequest request) {
		return readCookie(request, properties.authCookie().accessTokenName());
	}

	private void addCookie(
			HttpServletResponse response,
			String name,
			String value,
			Duration maxAge,
			String path
	) {
		AppSecurityProperties.AuthCookieProperties cookieProperties = properties.authCookie();
		ResponseCookie cookie = ResponseCookie.from(name, value)
				.httpOnly(true)
				.secure(cookieProperties.secure())
				.sameSite(cookieProperties.sameSite())
				.path(path)
				.maxAge(maxAge)
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	private String readCookie(HttpServletRequest request, String name) {
		Cookie[] cookies = request.getCookies();
		if (cookies == null) {
			return null;
		}

		for (Cookie cookie : cookies) {
			if (name.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
				return cookie.getValue().trim();
			}
		}

		return null;
	}
}

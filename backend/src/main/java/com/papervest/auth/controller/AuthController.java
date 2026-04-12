package com.papervest.auth.controller;

import com.papervest.auth.dto.AuthResponse;
import com.papervest.auth.dto.LoginRequest;
import com.papervest.auth.dto.LogoutRequest;
import com.papervest.auth.dto.RefreshTokenRequest;
import com.papervest.auth.dto.RegisterRequest;
import com.papervest.auth.dto.SessionResponse;
import com.papervest.auth.dto.AuthUserResponse;
import com.papervest.auth.service.AuthCookieService;
import com.papervest.auth.service.AuthService;
import com.papervest.common.security.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;
	private final AuthCookieService authCookieService;

	public AuthController(AuthService authService, AuthCookieService authCookieService) {
		this.authService = authService;
		this.authCookieService = authCookieService;
	}

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletResponse response) {
		AuthResponse authResponse = authService.register(request);
		authCookieService.writeSessionCookies(response, authResponse);
		return authResponse;
	}

	@PostMapping("/login")
	public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
		AuthResponse authResponse = authService.login(request);
		authCookieService.writeSessionCookies(response, authResponse);
		return authResponse;
	}

	@PostMapping("/refresh")
	public AuthResponse refresh(
			@Valid @RequestBody(required = false) RefreshTokenRequest request,
			HttpServletRequest httpRequest,
			HttpServletResponse response
	) {
		String refreshToken = authCookieService.resolveRefreshToken(
				httpRequest,
				request == null ? null : request.refreshToken()
		);
		AuthResponse authResponse = authService.refresh(
				refreshToken,
				request == null ? null : request.deviceName()
		);
		authCookieService.writeSessionCookies(response, authResponse);
		return authResponse;
	}

	@PostMapping("/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logout(
			@Valid @RequestBody(required = false) LogoutRequest request,
			HttpServletRequest httpRequest,
			HttpServletResponse response
	) {
		authService.logout(authCookieService.resolveRefreshToken(
				httpRequest,
				request == null ? null : request.refreshToken()
		));
		authCookieService.clearSessionCookies(response);
	}

	@GetMapping("/csrf")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void csrf() {
	}

	@GetMapping("/session")
	public SessionResponse session(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return new SessionResponse(new AuthUserResponse(currentUser.userId(), currentUser.email()));
	}
}

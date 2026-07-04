package com.papervest.account.controller;

import com.papervest.account.dto.AccountProfileResponse;
import com.papervest.account.dto.ChangePasswordRequest;
import com.papervest.account.dto.CashFlowListResponse;
import com.papervest.account.dto.CashFlowRequest;
import com.papervest.account.dto.CashFlowResponse;
import com.papervest.account.dto.DeleteAccountRequest;
import com.papervest.account.service.AccountCashFlowService;
import com.papervest.account.service.AccountService;
import com.papervest.auth.dto.AuthResponse;
import com.papervest.auth.service.AuthCookieService;
import com.papervest.common.security.AuthenticatedUser;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/account")
public class AccountController {

	private final AccountService accountService;
	private final AccountCashFlowService accountCashFlowService;
	private final AuthCookieService authCookieService;

	public AccountController(
			AccountService accountService,
			AccountCashFlowService accountCashFlowService,
			AuthCookieService authCookieService
	) {
		this.accountService = accountService;
		this.accountCashFlowService = accountCashFlowService;
		this.authCookieService = authCookieService;
	}

	@GetMapping
	public AccountProfileResponse profile(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return accountService.getProfile(currentUser.userId());
	}

	@GetMapping("/cash-flows")
	public CashFlowListResponse cashFlows(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return accountCashFlowService.list(currentUser.userId());
	}

	@PostMapping("/cash-flows/deposits")
	public CashFlowResponse depositCash(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody CashFlowRequest request,
			@RequestHeader(name = "X-Idempotency-Key", required = false) String idempotencyKey
	) {
		return accountCashFlowService.deposit(currentUser.userId(), request, idempotencyKey);
	}

	@PostMapping("/cash-flows/withdrawals")
	public CashFlowResponse withdrawCash(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody CashFlowRequest request,
			@RequestHeader(name = "X-Idempotency-Key", required = false) String idempotencyKey
	) {
		return accountCashFlowService.withdraw(currentUser.userId(), request, idempotencyKey);
	}

	@PostMapping("/change-password")
	public AuthResponse changePassword(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody ChangePasswordRequest request,
			HttpServletResponse response
	) {
		AuthResponse authResponse = accountService.changePassword(currentUser.userId(), request);
		authCookieService.writeSessionCookies(response, authResponse);
		return authResponse;
	}

	@PostMapping("/email-verification")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void sendEmailVerification(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		accountService.requestEmailVerification(currentUser.userId());
	}

	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteAccount(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody DeleteAccountRequest request,
			HttpServletResponse response
	) {
		accountService.deleteAccount(currentUser.userId(), request.currentPassword());
		authCookieService.clearSessionCookies(response);
	}
}

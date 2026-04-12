package com.papervest.conditionalorder.controller;

import com.papervest.common.security.AuthenticatedUser;
import com.papervest.conditionalorder.dto.ConditionalOrderDetailResponse;
import com.papervest.conditionalorder.dto.ConditionalOrderListResponse;
import com.papervest.conditionalorder.dto.ConditionalOrderResponse;
import com.papervest.conditionalorder.dto.CreateConditionalOrderRequest;
import com.papervest.conditionalorder.service.ConditionalOrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/conditional-orders")
public class ConditionalOrderController {

	private final ConditionalOrderService conditionalOrderService;

	public ConditionalOrderController(ConditionalOrderService conditionalOrderService) {
		this.conditionalOrderService = conditionalOrderService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ConditionalOrderResponse create(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody CreateConditionalOrderRequest request
	) {
		return conditionalOrderService.create(currentUser.userId(), request);
	}

	@GetMapping
	public ConditionalOrderListResponse list(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return conditionalOrderService.list(currentUser.userId());
	}

	@GetMapping("/{id}")
	public ConditionalOrderDetailResponse detail(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@PathVariable UUID id
	) {
		return conditionalOrderService.detail(currentUser.userId(), id);
	}

	@PostMapping("/{id}/cancel")
	public ConditionalOrderResponse cancel(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@PathVariable UUID id
	) {
		return conditionalOrderService.cancel(currentUser.userId(), id);
	}
}

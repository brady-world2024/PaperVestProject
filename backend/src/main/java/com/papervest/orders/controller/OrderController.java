package com.papervest.orders.controller;

import com.papervest.common.security.AuthenticatedUser;
import com.papervest.orders.dto.CreateOrderRequest;
import com.papervest.orders.dto.OrderDetailResponse;
import com.papervest.orders.dto.OrderListResponse;
import com.papervest.orders.dto.OrderResponse;
import com.papervest.orders.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

	private final OrderService orderService;

	public OrderController(OrderService orderService) {
		this.orderService = orderService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public OrderResponse create(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody CreateOrderRequest request,
			@RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey
	) {
		return orderService.submitPendingOrder(currentUser.userId(), request, idempotencyKey);
	}

	@GetMapping
	public OrderListResponse list(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return orderService.listOrders(currentUser.userId());
	}

	@GetMapping("/{orderId}")
	public OrderDetailResponse detail(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@PathVariable UUID orderId
	) {
		return orderService.getOrder(currentUser.userId(), orderId);
	}

	@PostMapping("/{orderId}/cancel")
	public OrderResponse cancel(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@PathVariable UUID orderId
	) {
		return orderService.cancelOrder(currentUser.userId(), orderId);
	}
}

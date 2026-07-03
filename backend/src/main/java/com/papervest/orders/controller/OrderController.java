package com.papervest.orders.controller;

import com.papervest.common.security.AuthenticatedUser;
import com.papervest.orders.dto.OrderDetailResponse;
import com.papervest.orders.dto.OrderListResponse;
import com.papervest.orders.service.OrderService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

	private final OrderService orderService;

	public OrderController(OrderService orderService) {
		this.orderService = orderService;
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
}

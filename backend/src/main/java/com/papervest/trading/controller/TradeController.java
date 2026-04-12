package com.papervest.trading.controller;

import com.papervest.common.security.AuthenticatedUser;
import com.papervest.trading.dto.TradeExecutionResponse;
import com.papervest.trading.dto.TradeHistoryResponse;
import com.papervest.trading.dto.TradeOrderRequest;
import com.papervest.trading.service.TradeService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trades")
public class TradeController {

	private final TradeService tradeService;

	public TradeController(TradeService tradeService) {
		this.tradeService = tradeService;
	}

	@PostMapping("/buy")
	public TradeExecutionResponse buy(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody TradeOrderRequest request,
			@RequestHeader(name = "X-Idempotency-Key", required = false) String idempotencyKey
	) {
		return tradeService.buy(currentUser.userId(), request, idempotencyKey);
	}

	@PostMapping("/sell")
	public TradeExecutionResponse sell(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody TradeOrderRequest request,
			@RequestHeader(name = "X-Idempotency-Key", required = false) String idempotencyKey
	) {
		return tradeService.sell(currentUser.userId(), request, idempotencyKey);
	}

	@GetMapping("/history")
	public TradeHistoryResponse history(@AuthenticationPrincipal AuthenticatedUser currentUser) {
		return tradeService.history(currentUser.userId());
	}
}

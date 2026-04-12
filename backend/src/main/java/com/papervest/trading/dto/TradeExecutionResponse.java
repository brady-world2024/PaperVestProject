package com.papervest.trading.dto;

import com.papervest.trading.model.TradeSide;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TradeExecutionResponse(
		UUID tradeId,
		String symbol,
		String companyName,
		TradeSide side,
		BigDecimal quantity,
		BigDecimal executedPrice,
		BigDecimal grossAmount,
		BigDecimal realizedPnl,
		BigDecimal cashBalanceAfterTrade,
		Instant executedAt,
		boolean idempotentReplay
) {
}

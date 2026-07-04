package com.papervest.account.dto;

import com.papervest.ledger.model.CashLedgerEntryType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CashFlowResponse(
		UUID id,
		CashLedgerEntryType type,
		BigDecimal amount,
		BigDecimal cashBalanceAfter,
		BigDecimal reservedCashAfter,
		String memo,
		Instant createdAt,
		boolean idempotentReplay
) {
}

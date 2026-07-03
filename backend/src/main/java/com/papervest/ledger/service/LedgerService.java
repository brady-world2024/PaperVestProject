package com.papervest.ledger.service;

import com.papervest.ledger.model.CashLedgerEntry;
import com.papervest.ledger.model.CashLedgerEntryType;
import com.papervest.ledger.model.PositionLedgerEntry;
import com.papervest.ledger.model.PositionLedgerEntryType;
import com.papervest.ledger.repository.CashLedgerEntryRepository;
import com.papervest.ledger.repository.PositionLedgerEntryRepository;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.trading.model.Holding;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class LedgerService {

	private final CashLedgerEntryRepository cashLedgerEntryRepository;
	private final PositionLedgerEntryRepository positionLedgerEntryRepository;

	public LedgerService(
			CashLedgerEntryRepository cashLedgerEntryRepository,
			PositionLedgerEntryRepository positionLedgerEntryRepository
	) {
		this.cashLedgerEntryRepository = cashLedgerEntryRepository;
		this.positionLedgerEntryRepository = positionLedgerEntryRepository;
	}

	public void recordTradeCashDebit(
			UUID userId,
			UUID orderId,
			UUID tradeId,
			BigDecimal amount,
			UserAccount account,
			String idempotencyKey
	) {
		recordCashEntry(
				userId,
				orderId,
				tradeId,
				CashLedgerEntryType.TRADE_DEBIT,
				amount.negate(),
				account,
				idempotencyKey,
				"Market buy cash debit"
		);
	}

	public void recordTradeCashCredit(
			UUID userId,
			UUID orderId,
			UUID tradeId,
			BigDecimal amount,
			UserAccount account,
			String idempotencyKey
	) {
		recordCashEntry(
				userId,
				orderId,
				tradeId,
				CashLedgerEntryType.TRADE_CREDIT,
				amount,
				account,
				idempotencyKey,
				"Market sell cash credit"
		);
	}

	public void recordPositionBuy(
			UUID userId,
			String symbol,
			UUID orderId,
			UUID tradeId,
			BigDecimal quantity,
			Holding holding,
			String idempotencyKey
	) {
		recordPositionEntry(
				userId,
				symbol,
				orderId,
				tradeId,
				PositionLedgerEntryType.TRADE_BUY,
				quantity,
				holding,
				idempotencyKey,
				"Market buy position increase"
		);
	}

	public void recordPositionSell(
			UUID userId,
			String symbol,
			UUID orderId,
			UUID tradeId,
			BigDecimal quantity,
			BigDecimal quantityAfter,
			BigDecimal reservedQuantityAfter,
			String idempotencyKey
	) {
		positionLedgerEntryRepository.findByIdempotencyKey(idempotencyKey)
				.orElseGet(() -> positionLedgerEntryRepository.save(new PositionLedgerEntry(
						userId,
						symbol,
						orderId,
						tradeId,
						PositionLedgerEntryType.TRADE_SELL,
						quantity.negate(),
						quantityAfter,
						reservedQuantityAfter,
						idempotencyKey,
						"Market sell position decrease"
				)));
	}

	private void recordCashEntry(
			UUID userId,
			UUID orderId,
			UUID tradeId,
			CashLedgerEntryType entryType,
			BigDecimal amount,
			UserAccount account,
			String idempotencyKey,
			String memo
	) {
		cashLedgerEntryRepository.findByIdempotencyKey(idempotencyKey)
				.orElseGet(() -> cashLedgerEntryRepository.save(new CashLedgerEntry(
						userId,
						orderId,
						tradeId,
						entryType,
						amount,
						account.getCashBalance(),
						account.getReservedCashBalance(),
						idempotencyKey,
						memo
				)));
	}

	private void recordPositionEntry(
			UUID userId,
			String symbol,
			UUID orderId,
			UUID tradeId,
			PositionLedgerEntryType entryType,
			BigDecimal quantity,
			Holding holding,
			String idempotencyKey,
			String memo
	) {
		positionLedgerEntryRepository.findByIdempotencyKey(idempotencyKey)
				.orElseGet(() -> positionLedgerEntryRepository.save(new PositionLedgerEntry(
						userId,
						symbol,
						orderId,
						tradeId,
						entryType,
						quantity,
						holding.getQuantity(),
						holding.getReservedQuantity(),
						idempotencyKey,
						memo
				)));
	}
}

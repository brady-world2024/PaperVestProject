package com.papervest.account.service;

import com.papervest.account.dto.CashFlowListResponse;
import com.papervest.account.dto.CashFlowRequest;
import com.papervest.account.dto.CashFlowResponse;
import com.papervest.common.exception.ApiException;
import com.papervest.common.exception.BadRequestException;
import com.papervest.common.exception.ConflictException;
import com.papervest.common.exception.ResourceNotFoundException;
import com.papervest.common.util.MoneyUtils;
import com.papervest.ledger.model.CashLedgerEntry;
import com.papervest.ledger.model.CashLedgerEntryType;
import com.papervest.ledger.repository.CashLedgerEntryRepository;
import com.papervest.ledger.service.LedgerService;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class AccountCashFlowService {

	private static final int MAX_IDEMPOTENCY_KEY_LENGTH = 120;
	private static final int MAX_MEMO_LENGTH = 120;
	private static final String IDEMPOTENCY_PREFIX = "cash-flow";
	private static final List<CashLedgerEntryType> EXTERNAL_CASH_FLOW_TYPES = List.of(
			CashLedgerEntryType.DEPOSIT,
			CashLedgerEntryType.WITHDRAWAL
	);

	private final UserAccountRepository userAccountRepository;
	private final CashLedgerEntryRepository cashLedgerEntryRepository;
	private final LedgerService ledgerService;

	public AccountCashFlowService(
			UserAccountRepository userAccountRepository,
			CashLedgerEntryRepository cashLedgerEntryRepository,
			LedgerService ledgerService
	) {
		this.userAccountRepository = userAccountRepository;
		this.cashLedgerEntryRepository = cashLedgerEntryRepository;
		this.ledgerService = ledgerService;
	}

	@Transactional(readOnly = true)
	public CashFlowListResponse list(UUID userId) {
		return new CashFlowListResponse(
				cashLedgerEntryRepository
						.findTop200ByUserIdAndEntryTypeInOrderByCreatedAtDesc(userId, EXTERNAL_CASH_FLOW_TYPES)
						.stream()
						.map(entry -> toResponse(entry, false))
						.toList()
		);
	}

	@Transactional
	public CashFlowResponse deposit(UUID userId, CashFlowRequest request, String idempotencyKey) {
		return recordCashFlow(userId, request, idempotencyKey, CashLedgerEntryType.DEPOSIT);
	}

	@Transactional
	public CashFlowResponse withdraw(UUID userId, CashFlowRequest request, String idempotencyKey) {
		return recordCashFlow(userId, request, idempotencyKey, CashLedgerEntryType.WITHDRAWAL);
	}

	private CashFlowResponse recordCashFlow(
			UUID userId,
			CashFlowRequest request,
			String idempotencyKey,
			CashLedgerEntryType entryType
	) {
		BigDecimal amount = normalizeAmount(request);
		BigDecimal signedAmount = signedAmount(entryType, amount);
		String memo = normalizeMemo(request.memo());
		String ledgerIdempotencyKey = namespaceIdempotencyKey(userId, idempotencyKey);

		CashLedgerEntry existingEntry = cashLedgerEntryRepository.findByIdempotencyKey(ledgerIdempotencyKey).orElse(null);
		if (existingEntry != null) {
			return toReplayResponse(existingEntry, entryType, signedAmount, memo);
		}

		UserAccount account = userAccountRepository.findByUserIdForUpdate(userId)
				.orElseThrow(() -> new ResourceNotFoundException("ACCOUNT_NOT_FOUND", "User portfolio account could not be found"));

		existingEntry = cashLedgerEntryRepository.findByIdempotencyKey(ledgerIdempotencyKey).orElse(null);
		if (existingEntry != null) {
			return toReplayResponse(existingEntry, entryType, signedAmount, memo);
		}

		if (entryType == CashLedgerEntryType.DEPOSIT) {
			account.credit(amount);
		}
		else {
			if (account.getAvailableCashBalance().compareTo(amount) < 0) {
				throw new ApiException(
						HttpStatus.UNPROCESSABLE_ENTITY,
						"INSUFFICIENT_CASH",
						"You do not have enough available cash to withdraw this amount"
				);
			}
			account.debit(amount);
		}

		CashLedgerEntry entry = ledgerService.recordExternalCashFlow(
				userId,
				entryType,
				signedAmount,
				account,
				ledgerIdempotencyKey,
				memo
		);
		return toResponse(entry, false);
	}

	private CashFlowResponse toReplayResponse(
			CashLedgerEntry existingEntry,
			CashLedgerEntryType entryType,
			BigDecimal signedAmount,
			String memo
	) {
		if (
				existingEntry.getEntryType() != entryType ||
						existingEntry.getAmount().compareTo(signedAmount) != 0 ||
						!Objects.equals(existingEntry.getMemo(), memo)
		) {
			throw new ConflictException(
					"IDEMPOTENCY_KEY_CONFLICT",
					"Idempotency key is already associated with a different cash-flow request"
			);
		}
		return toResponse(existingEntry, true);
	}

	private CashFlowResponse toResponse(CashLedgerEntry entry, boolean idempotentReplay) {
		return new CashFlowResponse(
				entry.getId(),
				entry.getEntryType(),
				entry.getAmount(),
				entry.getCashBalanceAfter(),
				entry.getReservedCashAfter(),
				entry.getMemo(),
				entry.getCreatedAt(),
				idempotentReplay
		);
	}

	private BigDecimal normalizeAmount(CashFlowRequest request) {
		if (request == null || request.amount() == null) {
			throw new BadRequestException("INVALID_AMOUNT", "Amount is required");
		}
		BigDecimal amount = MoneyUtils.scaleMoney(request.amount());
		if (amount.compareTo(BigDecimal.ZERO) <= 0) {
			throw new BadRequestException("INVALID_AMOUNT", "Amount must be greater than zero");
		}
		return amount;
	}

	private String normalizeMemo(String memo) {
		if (memo == null) {
			return null;
		}
		String trimmed = memo.trim();
		if (trimmed.length() > MAX_MEMO_LENGTH) {
			throw new BadRequestException("INVALID_MEMO", "Memo must be 120 characters or fewer");
		}
		return trimmed.isBlank() ? null : trimmed;
	}

	private String namespaceIdempotencyKey(UUID userId, String idempotencyKey) {
		if (idempotencyKey == null || idempotencyKey.isBlank()) {
			throw new BadRequestException("INVALID_IDEMPOTENCY_KEY", "Idempotency key is required");
		}
		String normalizedKey = idempotencyKey.trim();
		if (normalizedKey.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
			throw new BadRequestException("INVALID_IDEMPOTENCY_KEY", "Idempotency key is too long");
		}
		return "%s:%s:%s".formatted(IDEMPOTENCY_PREFIX, userId, normalizedKey);
	}

	private BigDecimal signedAmount(CashLedgerEntryType entryType, BigDecimal amount) {
		if (entryType == CashLedgerEntryType.DEPOSIT) {
			return amount;
		}
		return amount.negate();
	}
}

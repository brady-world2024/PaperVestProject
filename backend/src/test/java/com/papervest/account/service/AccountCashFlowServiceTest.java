package com.papervest.account.service;

import com.papervest.account.dto.CashFlowRequest;
import com.papervest.account.dto.CashFlowResponse;
import com.papervest.common.exception.ApiException;
import com.papervest.common.exception.ConflictException;
import com.papervest.ledger.model.CashLedgerEntry;
import com.papervest.ledger.model.CashLedgerEntryType;
import com.papervest.ledger.repository.CashLedgerEntryRepository;
import com.papervest.ledger.repository.PositionLedgerEntryRepository;
import com.papervest.ledger.service.LedgerService;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountCashFlowServiceTest {

	@Mock
	private UserAccountRepository userAccountRepository;

	@Mock
	private CashLedgerEntryRepository cashLedgerEntryRepository;

	@Mock
	private PositionLedgerEntryRepository positionLedgerEntryRepository;

	private AccountCashFlowService accountCashFlowService;

	@BeforeEach
	void setUp() {
		LedgerService ledgerService = new LedgerService(cashLedgerEntryRepository, positionLedgerEntryRepository);
		accountCashFlowService = new AccountCashFlowService(
				userAccountRepository,
				cashLedgerEntryRepository,
				ledgerService
		);
	}

	@Test
	void depositCreditsCashAndRecordsPositiveLedgerEntry() {
		UUID userId = UUID.randomUUID();
		UserAccount account = new UserAccount(userId, new BigDecimal("100000.00"));
		String ledgerKey = "cash-flow:%s:deposit-1".formatted(userId);

		when(userAccountRepository.findByUserIdForUpdate(userId)).thenReturn(Optional.of(account));
		when(cashLedgerEntryRepository.findByIdempotencyKey(ledgerKey)).thenReturn(Optional.empty());
		when(cashLedgerEntryRepository.save(any(CashLedgerEntry.class))).thenAnswer(invocation -> invocation.getArgument(0));

		CashFlowResponse response = accountCashFlowService.deposit(
				userId,
				new CashFlowRequest(new BigDecimal("250.00"), "  Payroll  "),
				" deposit-1 "
		);

		ArgumentCaptor<CashLedgerEntry> entryCaptor = ArgumentCaptor.forClass(CashLedgerEntry.class);
		verify(cashLedgerEntryRepository).save(entryCaptor.capture());
		CashLedgerEntry entry = entryCaptor.getValue();

		assertThat(account.getCashBalance()).isEqualByComparingTo("100250.00");
		assertThat(entry.getUserId()).isEqualTo(userId);
		assertThat(entry.getEntryType()).isEqualTo(CashLedgerEntryType.DEPOSIT);
		assertThat(entry.getAmount()).isEqualByComparingTo("250.00");
		assertThat(entry.getCashBalanceAfter()).isEqualByComparingTo("100250.00");
		assertThat(entry.getReservedCashAfter()).isEqualByComparingTo("0.00");
		assertThat(entry.getIdempotencyKey()).isEqualTo(ledgerKey);
		assertThat(entry.getMemo()).isEqualTo("Payroll");
		assertThat(response.id()).isEqualTo(entry.getId());
		assertThat(response.type()).isEqualTo(CashLedgerEntryType.DEPOSIT);
		assertThat(response.amount()).isEqualByComparingTo("250.00");
		assertThat(response.cashBalanceAfter()).isEqualByComparingTo("100250.00");
		assertThat(response.idempotentReplay()).isFalse();
	}

	@Test
	void withdrawalDebitsAvailableCashAndRecordsNegativeLedgerEntry() {
		UUID userId = UUID.randomUUID();
		UserAccount account = new UserAccount(userId, new BigDecimal("100000.00"));
		String ledgerKey = "cash-flow:%s:withdrawal-1".formatted(userId);

		when(userAccountRepository.findByUserIdForUpdate(userId)).thenReturn(Optional.of(account));
		when(cashLedgerEntryRepository.findByIdempotencyKey(ledgerKey)).thenReturn(Optional.empty());
		when(cashLedgerEntryRepository.save(any(CashLedgerEntry.class))).thenAnswer(invocation -> invocation.getArgument(0));

		CashFlowResponse response = accountCashFlowService.withdraw(
				userId,
				new CashFlowRequest(new BigDecimal("125.50"), "Bank transfer"),
				"withdrawal-1"
		);

		ArgumentCaptor<CashLedgerEntry> entryCaptor = ArgumentCaptor.forClass(CashLedgerEntry.class);
		verify(cashLedgerEntryRepository).save(entryCaptor.capture());
		CashLedgerEntry entry = entryCaptor.getValue();

		assertThat(account.getCashBalance()).isEqualByComparingTo("99874.50");
		assertThat(entry.getEntryType()).isEqualTo(CashLedgerEntryType.WITHDRAWAL);
		assertThat(entry.getAmount()).isEqualByComparingTo("-125.50");
		assertThat(entry.getCashBalanceAfter()).isEqualByComparingTo("99874.50");
		assertThat(entry.getIdempotencyKey()).isEqualTo(ledgerKey);
		assertThat(response.type()).isEqualTo(CashLedgerEntryType.WITHDRAWAL);
		assertThat(response.amount()).isEqualByComparingTo("-125.50");
		assertThat(response.cashBalanceAfter()).isEqualByComparingTo("99874.50");
		assertThat(response.idempotentReplay()).isFalse();
	}

	@Test
	void withdrawalRejectsInsufficientAvailableCash() {
		UUID userId = UUID.randomUUID();
		UserAccount account = new UserAccount(userId, new BigDecimal("100.00"));
		account.reserveCash(new BigDecimal("80.00"));
		String ledgerKey = "cash-flow:%s:too-much".formatted(userId);

		when(userAccountRepository.findByUserIdForUpdate(userId)).thenReturn(Optional.of(account));
		when(cashLedgerEntryRepository.findByIdempotencyKey(ledgerKey)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> accountCashFlowService.withdraw(
				userId,
				new CashFlowRequest(new BigDecimal("30.00"), null),
				"too-much"
		))
				.isInstanceOf(ApiException.class)
				.extracting(ex -> ((ApiException) ex).status(), ex -> ((ApiException) ex).code())
				.containsExactly(HttpStatus.UNPROCESSABLE_ENTITY, "INSUFFICIENT_CASH");

		assertThat(account.getCashBalance()).isEqualByComparingTo("100.00");
		verify(cashLedgerEntryRepository, never()).save(any(CashLedgerEntry.class));
	}

	@Test
	void idempotentRetryReturnsExistingLedgerEntryAndDoesNotApplyCashAgain() {
		UUID userId = UUID.randomUUID();
		String ledgerKey = "cash-flow:%s:deposit-retry".formatted(userId);
		CashLedgerEntry existingEntry = new CashLedgerEntry(
				userId,
				null,
				null,
				CashLedgerEntryType.DEPOSIT,
				new BigDecimal("75.00"),
				new BigDecimal("100075.00"),
				BigDecimal.ZERO,
				ledgerKey,
				"Broker ACH"
		);

		when(cashLedgerEntryRepository.findByIdempotencyKey(ledgerKey)).thenReturn(Optional.of(existingEntry));

		CashFlowResponse response = accountCashFlowService.deposit(
				userId,
				new CashFlowRequest(new BigDecimal("75.00"), "Broker ACH"),
				"deposit-retry"
		);

		assertThat(response.id()).isEqualTo(existingEntry.getId());
		assertThat(response.type()).isEqualTo(CashLedgerEntryType.DEPOSIT);
		assertThat(response.amount()).isEqualByComparingTo("75.00");
		assertThat(response.cashBalanceAfter()).isEqualByComparingTo("100075.00");
		assertThat(response.idempotentReplay()).isTrue();
		verify(userAccountRepository, never()).findByUserIdForUpdate(userId);
		verify(cashLedgerEntryRepository, never()).save(any(CashLedgerEntry.class));
	}

	@Test
	void reusingIdempotencyKeyForDifferentPayloadConflicts() {
		UUID userId = UUID.randomUUID();
		String ledgerKey = "cash-flow:%s:shared-key".formatted(userId);
		CashLedgerEntry existingEntry = new CashLedgerEntry(
				userId,
				null,
				null,
				CashLedgerEntryType.DEPOSIT,
				new BigDecimal("50.00"),
				new BigDecimal("100050.00"),
				BigDecimal.ZERO,
				ledgerKey,
				"Initial deposit"
		);

		when(cashLedgerEntryRepository.findByIdempotencyKey(ledgerKey)).thenReturn(Optional.of(existingEntry));

		assertThatThrownBy(() -> accountCashFlowService.withdraw(
				userId,
				new CashFlowRequest(new BigDecimal("50.00"), "Initial deposit"),
				"shared-key"
		))
				.isInstanceOf(ConflictException.class)
				.extracting(ex -> ((ConflictException) ex).code())
				.isEqualTo("IDEMPOTENCY_KEY_CONFLICT");

		verify(userAccountRepository, never()).findByUserIdForUpdate(userId);
		verify(cashLedgerEntryRepository, never()).save(any(CashLedgerEntry.class));
	}
}

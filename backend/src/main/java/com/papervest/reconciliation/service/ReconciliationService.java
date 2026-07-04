package com.papervest.reconciliation.service;

import com.papervest.reconciliation.model.ReconciliationIssue;
import com.papervest.reconciliation.model.ReconciliationIssueCode;
import com.papervest.reconciliation.model.ReconciliationReport;
import com.papervest.reconciliation.model.ReconciliationSeverity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ReconciliationService {

	private final JdbcTemplate jdbcTemplate;

	public ReconciliationService(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Transactional(readOnly = true)
	public ReconciliationReport scan() {
		List<ReconciliationIssue> issues = new ArrayList<>();
		checkCashLedgerState(issues);
		checkPositionLedgerState(issues);
		checkPendingCashReservations(issues);
		checkPendingPositionReservations(issues);
		checkTerminalOrderReservations(issues);
		return new ReconciliationReport(Instant.now(), issues);
	}

	private void checkCashLedgerState(List<ReconciliationIssue> issues) {
		List<AccountAggregate> accounts = jdbcTemplate.query("""
				select
				  account.user_id,
				  account.initial_cash,
				  account.cash_balance,
				  account.reserved_cash_balance,
				  coalesce(sum(case when ledger.entry_type in ('TRADE_DEBIT', 'TRADE_CREDIT') then ledger.amount else 0 end), 0) as ledger_cash_delta,
				  coalesce(sum(case when ledger.entry_type in ('RESERVATION', 'RELEASE') then ledger.amount else 0 end), 0) as ledger_reserved_delta
				from user_accounts account
				left join cash_ledger_entries ledger on ledger.user_id = account.user_id
				group by account.user_id, account.initial_cash, account.cash_balance, account.reserved_cash_balance
				""", (rs, rowNum) -> new AccountAggregate(
				uuid(rs, "user_id"),
				rs.getBigDecimal("initial_cash"),
				rs.getBigDecimal("cash_balance"),
				rs.getBigDecimal("reserved_cash_balance"),
				rs.getBigDecimal("ledger_cash_delta"),
				rs.getBigDecimal("ledger_reserved_delta")
		));

		for (AccountAggregate account : accounts) {
			BigDecimal expectedCash = account.initialCash().add(account.ledgerCashDelta());
			if (account.cashBalance().compareTo(expectedCash) != 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.CASH_LEDGER_BALANCE_MISMATCH,
						ReconciliationSeverity.CRITICAL,
						account.userId(),
						null,
						null,
						expectedCash,
						account.cashBalance(),
						"Account cash balance does not match cash ledger deltas"
				);
			}
			if (account.reservedCashBalance().compareTo(account.ledgerReservedDelta()) != 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.CASH_LEDGER_RESERVED_MISMATCH,
						ReconciliationSeverity.CRITICAL,
						account.userId(),
						null,
						null,
						account.ledgerReservedDelta(),
						account.reservedCashBalance(),
						"Account reserved cash does not match cash ledger reservation deltas"
				);
			}
			if (account.cashBalance().compareTo(BigDecimal.ZERO) < 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.CASH_NEGATIVE_BALANCE,
						ReconciliationSeverity.CRITICAL,
						account.userId(),
						null,
						null,
						BigDecimal.ZERO,
						account.cashBalance(),
						"Account cash balance is negative"
				);
			}
			if (account.reservedCashBalance().compareTo(BigDecimal.ZERO) < 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.CASH_NEGATIVE_RESERVED_BALANCE,
						ReconciliationSeverity.CRITICAL,
						account.userId(),
						null,
						null,
						BigDecimal.ZERO,
						account.reservedCashBalance(),
						"Account reserved cash balance is negative"
				);
			}
		}
	}

	private void checkPositionLedgerState(List<ReconciliationIssue> issues) {
		List<HoldingAggregate> holdings = jdbcTemplate.query("""
				select
				  holding.user_id,
				  holding.symbol,
				  holding.quantity,
				  holding.reserved_quantity,
				  coalesce(sum(case when ledger.entry_type in ('TRADE_BUY', 'TRADE_SELL') then ledger.quantity_delta else 0 end), 0) as ledger_quantity_delta,
				  coalesce(sum(case when ledger.entry_type in ('RESERVATION', 'RELEASE') then ledger.quantity_delta else 0 end), 0) as ledger_reserved_delta
				from holdings holding
				left join position_ledger_entries ledger on ledger.user_id = holding.user_id and ledger.symbol = holding.symbol
				group by holding.user_id, holding.symbol, holding.quantity, holding.reserved_quantity
				""", (rs, rowNum) -> new HoldingAggregate(
				uuid(rs, "user_id"),
				rs.getString("symbol"),
				rs.getBigDecimal("quantity"),
				rs.getBigDecimal("reserved_quantity"),
				rs.getBigDecimal("ledger_quantity_delta"),
				rs.getBigDecimal("ledger_reserved_delta")
		));

		for (HoldingAggregate holding : holdings) {
			if (holding.quantity().compareTo(holding.ledgerQuantityDelta()) != 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.POSITION_LEDGER_QUANTITY_MISMATCH,
						ReconciliationSeverity.CRITICAL,
						holding.userId(),
						holding.symbol(),
						null,
						holding.ledgerQuantityDelta(),
						holding.quantity(),
						"Holding quantity does not match position ledger trade deltas"
				);
			}
			BigDecimal expectedReservedQuantity = holding.ledgerReservedDelta().negate();
			if (holding.reservedQuantity().compareTo(expectedReservedQuantity) != 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.POSITION_LEDGER_RESERVED_MISMATCH,
						ReconciliationSeverity.CRITICAL,
						holding.userId(),
						holding.symbol(),
						null,
						expectedReservedQuantity,
						holding.reservedQuantity(),
						"Holding reserved quantity does not match position ledger reservation deltas"
				);
			}
			if (holding.quantity().compareTo(BigDecimal.ZERO) < 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.POSITION_NEGATIVE_QUANTITY,
						ReconciliationSeverity.CRITICAL,
						holding.userId(),
						holding.symbol(),
						null,
						BigDecimal.ZERO,
						holding.quantity(),
						"Holding quantity is negative"
				);
			}
			if (holding.reservedQuantity().compareTo(BigDecimal.ZERO) < 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.POSITION_NEGATIVE_RESERVED_QUANTITY,
						ReconciliationSeverity.CRITICAL,
						holding.userId(),
						holding.symbol(),
						null,
						BigDecimal.ZERO,
						holding.reservedQuantity(),
						"Holding reserved quantity is negative"
				);
			}
			if (holding.reservedQuantity().compareTo(holding.quantity()) > 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.POSITION_RESERVED_EXCEEDS_QUANTITY,
						ReconciliationSeverity.CRITICAL,
						holding.userId(),
						holding.symbol(),
						null,
						holding.quantity(),
						holding.reservedQuantity(),
						"Holding reserved quantity exceeds total quantity"
				);
			}
		}
	}

	private void checkPendingCashReservations(List<ReconciliationIssue> issues) {
		List<AccountPendingReservation> accounts = jdbcTemplate.query("""
				select
				  account.user_id,
				  account.reserved_cash_balance,
				  coalesce(sum(case when orders.status = 'PENDING' and orders.side = 'BUY' then orders.reserved_cash_amount else 0 end), 0) as pending_reserved_cash
				from user_accounts account
				left join orders on orders.user_id = account.user_id
				group by account.user_id, account.reserved_cash_balance
				""", (rs, rowNum) -> new AccountPendingReservation(
				uuid(rs, "user_id"),
				rs.getBigDecimal("reserved_cash_balance"),
				rs.getBigDecimal("pending_reserved_cash")
		));

		for (AccountPendingReservation account : accounts) {
			if (account.actualReservedCash().compareTo(account.pendingReservedCash()) != 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.PENDING_CASH_RESERVATION_MISMATCH,
						ReconciliationSeverity.CRITICAL,
						account.userId(),
						null,
						null,
						account.pendingReservedCash(),
						account.actualReservedCash(),
						"Account reserved cash does not match open BUY order reservations"
				);
			}
		}
	}

	private void checkPendingPositionReservations(List<ReconciliationIssue> issues) {
		List<HoldingPendingReservation> holdings = jdbcTemplate.query("""
				select
				  holding.user_id,
				  holding.symbol,
				  holding.reserved_quantity,
				  coalesce(sum(case when orders.status = 'PENDING' and orders.side = 'SELL' then orders.reserved_quantity else 0 end), 0) as pending_reserved_quantity
				from holdings holding
				left join orders on orders.user_id = holding.user_id and orders.symbol = holding.symbol
				group by holding.user_id, holding.symbol, holding.reserved_quantity
				""", (rs, rowNum) -> new HoldingPendingReservation(
				uuid(rs, "user_id"),
				rs.getString("symbol"),
				rs.getBigDecimal("reserved_quantity"),
				rs.getBigDecimal("pending_reserved_quantity")
		));

		for (HoldingPendingReservation holding : holdings) {
			if (holding.actualReservedQuantity().compareTo(holding.pendingReservedQuantity()) != 0) {
				addIssue(
						issues,
						ReconciliationIssueCode.PENDING_POSITION_RESERVATION_MISMATCH,
						ReconciliationSeverity.CRITICAL,
						holding.userId(),
						holding.symbol(),
						null,
						holding.pendingReservedQuantity(),
						holding.actualReservedQuantity(),
						"Holding reserved quantity does not match open SELL order reservations"
				);
			}
		}
	}

	private void checkTerminalOrderReservations(List<ReconciliationIssue> issues) {
		List<TerminalOrderReservation> orders = jdbcTemplate.query("""
				select id, user_id, symbol, status, reserved_cash_amount, reserved_quantity
				from orders
				where status <> 'PENDING'
				  and (reserved_cash_amount <> 0 or reserved_quantity <> 0)
				""", (rs, rowNum) -> new TerminalOrderReservation(
				uuid(rs, "id"),
				uuid(rs, "user_id"),
				rs.getString("symbol"),
				rs.getString("status"),
				rs.getBigDecimal("reserved_cash_amount"),
				rs.getBigDecimal("reserved_quantity")
		));

		for (TerminalOrderReservation order : orders) {
			addIssue(
					issues,
					ReconciliationIssueCode.TERMINAL_ORDER_RESERVATION_NOT_RELEASED,
					ReconciliationSeverity.CRITICAL,
					order.userId(),
					order.symbol(),
					order.id(),
					"reserved cash 0.00 and reserved quantity 0.0000",
					"reserved cash %s and reserved quantity %s".formatted(value(order.reservedCashAmount()), value(order.reservedQuantity())),
					"Terminal order %s still has retained reservation amounts".formatted(order.status())
			);
		}
	}

	private void addIssue(
			List<ReconciliationIssue> issues,
			ReconciliationIssueCode code,
			ReconciliationSeverity severity,
			UUID userId,
			String symbol,
			UUID orderId,
			BigDecimal expectedValue,
			BigDecimal actualValue,
			String message
	) {
		addIssue(issues, code, severity, userId, symbol, orderId, value(expectedValue), value(actualValue), message);
	}

	private void addIssue(
			List<ReconciliationIssue> issues,
			ReconciliationIssueCode code,
			ReconciliationSeverity severity,
			UUID userId,
			String symbol,
			UUID orderId,
			String expectedValue,
			String actualValue,
			String message
	) {
		issues.add(new ReconciliationIssue(
				code,
				severity,
				userId,
				symbol,
				orderId,
				expectedValue,
				actualValue,
				message
		));
	}

	private String value(BigDecimal value) {
		return value.stripTrailingZeros().toPlainString();
	}

	private UUID uuid(ResultSet rs, String column) throws SQLException {
		Object value = rs.getObject(column);
		if (value instanceof UUID uuid) {
			return uuid;
		}
		return UUID.fromString(value.toString());
	}

	private record AccountAggregate(
			UUID userId,
			BigDecimal initialCash,
			BigDecimal cashBalance,
			BigDecimal reservedCashBalance,
			BigDecimal ledgerCashDelta,
			BigDecimal ledgerReservedDelta
	) {
	}

	private record HoldingAggregate(
			UUID userId,
			String symbol,
			BigDecimal quantity,
			BigDecimal reservedQuantity,
			BigDecimal ledgerQuantityDelta,
			BigDecimal ledgerReservedDelta
	) {
	}

	private record AccountPendingReservation(
			UUID userId,
			BigDecimal actualReservedCash,
			BigDecimal pendingReservedCash
	) {
	}

	private record HoldingPendingReservation(
			UUID userId,
			String symbol,
			BigDecimal actualReservedQuantity,
			BigDecimal pendingReservedQuantity
	) {
	}

	private record TerminalOrderReservation(
			UUID id,
			UUID userId,
			String symbol,
			String status,
			BigDecimal reservedCashAmount,
			BigDecimal reservedQuantity
	) {
	}
}

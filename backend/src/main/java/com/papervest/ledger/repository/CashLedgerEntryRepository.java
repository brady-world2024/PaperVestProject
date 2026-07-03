package com.papervest.ledger.repository;

import com.papervest.ledger.model.CashLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CashLedgerEntryRepository extends JpaRepository<CashLedgerEntry, UUID> {

	Optional<CashLedgerEntry> findByIdempotencyKey(String idempotencyKey);
}

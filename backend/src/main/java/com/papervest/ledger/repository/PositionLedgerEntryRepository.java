package com.papervest.ledger.repository;

import com.papervest.ledger.model.PositionLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PositionLedgerEntryRepository extends JpaRepository<PositionLedgerEntry, UUID> {

	Optional<PositionLedgerEntry> findByIdempotencyKey(String idempotencyKey);
}

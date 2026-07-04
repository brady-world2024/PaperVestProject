package com.papervest.ledger.repository;

import com.papervest.ledger.model.CashLedgerEntry;
import com.papervest.ledger.model.CashLedgerEntryType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CashLedgerEntryRepository extends JpaRepository<CashLedgerEntry, UUID> {

	Optional<CashLedgerEntry> findByIdempotencyKey(String idempotencyKey);

	List<CashLedgerEntry> findTop200ByUserIdAndEntryTypeInOrderByCreatedAtDesc(
			UUID userId,
			Collection<CashLedgerEntryType> entryTypes
	);

	@Query("""
			select coalesce(sum(entry.amount), 0)
			from CashLedgerEntry entry
			where entry.userId = :userId
			  and entry.entryType in :entryTypes
			  and entry.createdAt >= :fromInclusive
			  and entry.createdAt < :toExclusive
			""")
	BigDecimal sumAmountByUserIdAndEntryTypeInAndCreatedAtBetween(
			@Param("userId") UUID userId,
			@Param("entryTypes") Collection<CashLedgerEntryType> entryTypes,
			@Param("fromInclusive") Instant fromInclusive,
			@Param("toExclusive") Instant toExclusive
	);
}

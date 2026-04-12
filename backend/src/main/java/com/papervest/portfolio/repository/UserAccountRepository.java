package com.papervest.portfolio.repository;

import com.papervest.portfolio.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

	Optional<UserAccount> findByUserId(UUID userId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select account from UserAccount account where account.userId = :userId")
	Optional<UserAccount> findByUserIdForUpdate(UUID userId);
}

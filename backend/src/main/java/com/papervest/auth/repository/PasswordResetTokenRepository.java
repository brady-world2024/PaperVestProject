package com.papervest.auth.repository;

import com.papervest.auth.model.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

	Optional<PasswordResetToken> findByTokenHash(String tokenHash);

	List<PasswordResetToken> findAllByUserIdAndConsumedAtIsNull(UUID userId);
}

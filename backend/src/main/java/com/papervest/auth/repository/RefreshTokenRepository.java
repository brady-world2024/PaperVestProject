package com.papervest.auth.repository;

import com.papervest.auth.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

	Optional<RefreshToken> findByTokenHash(String tokenHash);

	List<RefreshToken> findAllByUserIdAndRevokedAtIsNull(UUID userId);

	List<RefreshToken> findTop10ByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(UUID userId);
}

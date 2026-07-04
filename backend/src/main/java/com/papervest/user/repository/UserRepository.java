package com.papervest.user.repository;

import com.papervest.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

	boolean existsByEmail(String email);

	Optional<User> findByEmail(String email);

	List<User> findTop25ByOrderByCreatedAtDesc();

	List<User> findTop25ByEmailContainingIgnoreCaseOrderByCreatedAtDesc(String email);

	List<User> findAllByEmailIn(Collection<String> emails);

	@Query("select user.id from User user")
	List<UUID> findAllIds();
}

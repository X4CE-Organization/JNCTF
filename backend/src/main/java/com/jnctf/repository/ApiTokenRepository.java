package com.jnctf.repository;

import com.jnctf.domain.ApiToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApiTokenRepository extends JpaRepository<ApiToken, Long> {

    Optional<ApiToken> findByTokenHashAndRevokedFalse(String tokenHash);

    List<ApiToken> findByUserIdOrderByIdDesc(Long userId);
}

package com.jnctf.repository;

import com.jnctf.domain.Hint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HintRepository extends JpaRepository<Hint, Long> {

    List<Hint> findByChallengeIdOrderBySortOrderAscIdAsc(Long challengeId);

    void deleteByChallengeId(Long challengeId);
}

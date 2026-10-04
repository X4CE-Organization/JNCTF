package com.jnctf.repository;

import com.jnctf.domain.ChallengeFlag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChallengeFlagRepository extends JpaRepository<ChallengeFlag, Long> {

    List<ChallengeFlag> findByChallengeId(Long challengeId);

    void deleteByChallengeId(Long challengeId);
}

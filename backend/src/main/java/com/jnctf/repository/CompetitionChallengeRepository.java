package com.jnctf.repository;

import com.jnctf.domain.CompetitionChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompetitionChallengeRepository extends JpaRepository<CompetitionChallenge, Long> {

    List<CompetitionChallenge> findByCompetitionIdOrderBySortOrderAscIdAsc(Long competitionId);

    Optional<CompetitionChallenge> findByCompetitionIdAndChallengeId(Long competitionId, Long challengeId);

    void deleteByCompetitionIdAndChallengeId(Long competitionId, Long challengeId);
}

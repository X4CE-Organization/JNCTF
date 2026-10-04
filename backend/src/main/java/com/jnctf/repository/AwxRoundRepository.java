package com.jnctf.repository;

import com.jnctf.domain.AwxRound;
import com.jnctf.domain.AwxRoundState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AwxRoundRepository extends JpaRepository<AwxRound, Long> {

    List<AwxRound> findByCompetitionIdOrderByRoundNoAsc(Long competitionId);

    Optional<AwxRound> findFirstByCompetitionIdAndStateOrderByRoundNoAsc(Long competitionId, AwxRoundState state);

    Optional<AwxRound> findByCompetitionIdAndRoundNo(Long competitionId, Integer roundNo);

    long countByCompetitionId(Long competitionId);
}

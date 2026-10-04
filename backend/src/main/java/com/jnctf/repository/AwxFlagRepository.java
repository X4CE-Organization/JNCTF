package com.jnctf.repository;

import com.jnctf.domain.AwxFlag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AwxFlagRepository extends JpaRepository<AwxFlag, Long> {

    Optional<AwxFlag> findByFlagAndExpiredFalse(String flag);

    List<AwxFlag> findByRoundId(Long roundId);

    List<AwxFlag> findByCompetitionIdAndTeamId(Long competitionId, Long teamId);
}

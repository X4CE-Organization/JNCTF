package com.jnctf.repository;

import com.jnctf.domain.AwxCheck;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AwxCheckRepository extends JpaRepository<AwxCheck, Long> {

    List<AwxCheck> findByRoundId(Long roundId);

    List<AwxCheck> findByCompetitionIdAndTeamIdOrderByIdDesc(Long competitionId, Long teamId);
}

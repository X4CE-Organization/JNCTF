package com.jnctf.repository;

import com.jnctf.domain.AwxTarget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AwxTargetRepository extends JpaRepository<AwxTarget, Long> {

    List<AwxTarget> findByCompetitionIdOrderByIdAsc(Long competitionId);

    List<AwxTarget> findByCompetitionIdAndTeamId(Long competitionId, Long teamId);

    Optional<AwxTarget> findByAwxServiceIdAndTeamId(Long awxServiceId, Long teamId);

    long countByCompetitionId(Long competitionId);
}

package com.jnctf.repository;

import com.jnctf.domain.AwxAttack;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AwxAttackRepository extends JpaRepository<AwxAttack, Long> {

    List<AwxAttack> findByRoundIdOrderByIdDesc(Long roundId);

    List<AwxAttack> findByCompetitionIdOrderByIdDesc(Long competitionId);

    List<AwxAttack> findTop50ByAttackerTeamIdOrderByIdDesc(Long attackerTeamId);

    List<AwxAttack> findTop50ByVictimTeamIdOrderByIdDesc(Long victimTeamId);

    long countByCompetitionIdAndAttackerTeamId(Long competitionId, Long attackerTeamId);
}

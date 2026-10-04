package com.jnctf.repository;

import com.jnctf.domain.Solve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SolveRepository extends JpaRepository<Solve, Long> {

    Optional<Solve> findByUserIdAndChallengeIdAndCompetitionId(Long userId, Long challengeId, Long competitionId);

    Optional<Solve> findFirstByTeamIdAndChallengeIdAndCompetitionId(Long teamId, Long challengeId, Long competitionId);

    List<Solve> findByUserIdOrderByIdDesc(Long userId);

    List<Solve> findByChallengeIdOrderByIdAsc(Long challengeId);

    List<Solve> findByCompetitionId(Long competitionId);

    long countByChallengeIdAndCompetitionId(Long challengeId, Long competitionId);

    long countByUserId(Long userId);

    @Query("select coalesce(sum(s.score), 0) from Solve s where s.competitionId = :competitionId and s.teamId = :teamId")
    int sumTeamScoreInCompetition(@Param("competitionId") Long competitionId, @Param("teamId") Long teamId);

    @Query("select coalesce(sum(s.score), 0) from Solve s where s.competitionId = :competitionId and s.userId = :userId")
    int sumUserScoreInCompetition(@Param("competitionId") Long competitionId, @Param("userId") Long userId);

    @Query("select distinct s.challengeId from Solve s where s.userId = :userId")
    List<Long> findSolvedChallengeIds(@Param("userId") Long userId);

    @Query("select distinct s.challengeId from Solve s where s.teamId = :teamId")
    List<Long> findSolvedChallengeIdsByTeam(@Param("teamId") Long teamId);
}

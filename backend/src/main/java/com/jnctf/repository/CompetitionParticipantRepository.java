package com.jnctf.repository;

import com.jnctf.domain.CompetitionParticipant;
import com.jnctf.domain.ParticipantStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompetitionParticipantRepository extends JpaRepository<CompetitionParticipant, Long> {

    Optional<CompetitionParticipant> findByCompetitionIdAndUserId(Long competitionId, Long userId);

    List<CompetitionParticipant> findByCompetitionIdOrderByScoreDesc(Long competitionId);

    List<CompetitionParticipant> findByCompetitionIdAndStatus(Long competitionId, ParticipantStatus status);

    List<CompetitionParticipant> findByUserIdOrderByIdDesc(Long userId);

    long countByCompetitionIdAndStatus(Long competitionId, ParticipantStatus status);
}

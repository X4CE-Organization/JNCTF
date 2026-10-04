package com.jnctf.repository;

import com.jnctf.domain.CompetitionAnnouncement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompetitionAnnouncementRepository extends JpaRepository<CompetitionAnnouncement, Long> {

    List<CompetitionAnnouncement> findByCompetitionIdOrderByIdDesc(Long competitionId);
}

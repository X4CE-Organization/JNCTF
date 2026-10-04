package com.jnctf.repository;

import com.jnctf.domain.Submission;
import com.jnctf.domain.SubmissionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubmissionRepository extends JpaRepository<Submission, Long> {

    Page<Submission> findByUserIdOrderByIdDesc(Long userId, Pageable pageable);

    Page<Submission> findByChallengeIdOrderByIdDesc(Long challengeId, Pageable pageable);

    Page<Submission> findByCompetitionIdOrderByIdDesc(Long competitionId, Pageable pageable);

    List<Submission> findTop20ByUserIdAndChallengeIdOrderByIdDesc(Long userId, Long challengeId);

    long countByUserIdAndChallengeIdAndStatus(Long userId, Long challengeId, SubmissionStatus status);

    long countByUserIdAndCompetitionId(Long userId, Long competitionId);

    long countByChallengeId(Long challengeId);

    long countByStatus(SubmissionStatus status);
}

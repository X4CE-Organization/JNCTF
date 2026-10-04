package com.jnctf.repository;

import com.jnctf.domain.ChallengeInstance;
import com.jnctf.domain.InstanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ChallengeInstanceRepository extends JpaRepository<ChallengeInstance, Long> {

    Optional<ChallengeInstance> findFirstByUserIdAndChallengeIdOrderByIdDesc(Long userId, Long challengeId);

    List<ChallengeInstance> findByUserIdOrderByIdDesc(Long userId);

    List<ChallengeInstance> findByStatusAndExpiresAtBefore(InstanceStatus status, Instant time);

    long countByStatus(InstanceStatus status);
}

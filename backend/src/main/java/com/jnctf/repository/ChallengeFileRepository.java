package com.jnctf.repository;

import com.jnctf.domain.ChallengeFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChallengeFileRepository extends JpaRepository<ChallengeFile, Long> {

    List<ChallengeFile> findByChallengeIdOrderByIdAsc(Long challengeId);

    void deleteByChallengeId(Long challengeId);
}

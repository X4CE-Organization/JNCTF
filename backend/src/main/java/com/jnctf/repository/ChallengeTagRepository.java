package com.jnctf.repository;

import com.jnctf.domain.ChallengeTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChallengeTagRepository extends JpaRepository<ChallengeTag, Long> {

    List<ChallengeTag> findByChallengeId(Long challengeId);

    List<ChallengeTag> findByTagId(Long tagId);

    void deleteByChallengeId(Long challengeId);
}

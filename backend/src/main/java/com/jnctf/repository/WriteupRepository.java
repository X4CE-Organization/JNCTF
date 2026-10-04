package com.jnctf.repository;

import com.jnctf.domain.Writeup;
import com.jnctf.domain.WriteupState;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WriteupRepository extends JpaRepository<Writeup, Long> {

    Page<Writeup> findByState(WriteupState state, Pageable pageable);

    Page<Writeup> findByUserId(Long userId, Pageable pageable);

    List<Writeup> findByChallengeIdAndState(Long challengeId, WriteupState state);

    long countByState(WriteupState state);
}

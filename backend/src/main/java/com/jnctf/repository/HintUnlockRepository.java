package com.jnctf.repository;

import com.jnctf.domain.HintUnlock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HintUnlockRepository extends JpaRepository<HintUnlock, Long> {

    Optional<HintUnlock> findByHintIdAndUserId(Long hintId, Long userId);

    List<HintUnlock> findByUserId(Long userId);
}

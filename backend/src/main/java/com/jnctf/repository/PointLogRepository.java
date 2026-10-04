package com.jnctf.repository;

import com.jnctf.domain.PointLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PointLogRepository extends JpaRepository<PointLog, Long> {

    Page<PointLog> findByUserIdOrderByIdDesc(Long userId, Pageable pageable);
}

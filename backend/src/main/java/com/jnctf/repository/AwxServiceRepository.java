package com.jnctf.repository;

import com.jnctf.domain.AwxService;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AwxServiceRepository extends JpaRepository<AwxService, Long> {

    List<AwxService> findByCompetitionIdOrderBySortOrderAscIdAsc(Long competitionId);
}

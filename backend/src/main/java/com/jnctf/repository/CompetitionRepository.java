package com.jnctf.repository;

import com.jnctf.domain.Competition;
import com.jnctf.domain.CompetitionState;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CompetitionRepository extends JpaRepository<Competition, Long> {

    Optional<Competition> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Competition> findByPublishedTrueOrderByStartAtDesc();

    Page<Competition> findByPublishedTrue(Pageable pageable);

    long countByState(CompetitionState state);

    @Query("""
            select c from Competition c
            where c.published = true
              and (:keyword = '' or lower(c.name) like lower(concat('%', :keyword, '%')))
              and (:state is null or c.state = :state)
              and (:type is null or c.type = :type)
            """)
    Page<Competition> searchPublic(@Param("keyword") String keyword,
                                   @Param("state") CompetitionState state,
                                   @Param("type") com.jnctf.domain.CompetitionType type,
                                   Pageable pageable);

    @Query("select c from Competition c where c.state = :state and c.startAt <= :now and c.endAt > :now")
    List<Competition> findRunning(@Param("state") CompetitionState state, @Param("now") Instant now);

    @Query("select c from Competition c where c.published = true and c.state in ('PUBLISHED','RUNNING','FROZEN') and c.endAt > :now order by c.startAt asc")
    List<Competition> findUpcoming(@Param("now") Instant now, Pageable pageable);
}

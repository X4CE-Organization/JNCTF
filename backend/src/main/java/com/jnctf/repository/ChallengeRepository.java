package com.jnctf.repository;

import com.jnctf.domain.Challenge;
import com.jnctf.domain.ChallengeState;
import com.jnctf.domain.Difficulty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {

    List<Challenge> findByStateOrderBySortOrderAscIdAsc(ChallengeState state);

    List<Challenge> findAllByOrderBySortOrderAscIdAsc();

    long countByCategoryId(Long categoryId);

    long countByState(ChallengeState state);

    @Query("""
            select c from Challenge c
            where (:keyword = '' or lower(c.title) like lower(concat('%', :keyword, '%')))
              and (:categoryId is null or c.categoryId = :categoryId)
              and (:difficulty is null or c.difficulty = :difficulty)
              and (:state is null or c.state = :state)
            """)
    Page<Challenge> search(@Param("keyword") String keyword,
                           @Param("categoryId") Long categoryId,
                           @Param("difficulty") Difficulty difficulty,
                           @Param("state") ChallengeState state,
                           Pageable pageable);
}

package com.jnctf.repository;

import com.jnctf.domain.Team;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TeamRepository extends JpaRepository<Team, Long> {

    Optional<Team> findByName(String name);

    Optional<Team> findByInviteCode(String inviteCode);

    boolean existsByName(String name);

    List<Team> findTop50ByHiddenFalseOrderByScoreDesc();

    @Query("""
            select t from Team t
            where :keyword = '' or lower(t.name) like lower(concat('%', :keyword, '%'))
            """)
    Page<Team> search(@Param("keyword") String keyword, Pageable pageable);
}

package com.jnctf.repository;

import com.jnctf.domain.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    List<TeamMember> findByTeamIdOrderByJoinedAtAsc(Long teamId);

    Optional<TeamMember> findByUserId(Long userId);

    Optional<TeamMember> findByTeamIdAndUserId(Long teamId, Long userId);

    long countByTeamId(Long teamId);

    void deleteByTeamId(Long teamId);
}

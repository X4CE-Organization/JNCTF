package com.jnctf.repository;

import com.jnctf.domain.TeamInvite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeamInviteRepository extends JpaRepository<TeamInvite, Long> {

    Optional<TeamInvite> findByCode(String code);

    List<TeamInvite> findByTeamIdOrderByIdDesc(Long teamId);
}

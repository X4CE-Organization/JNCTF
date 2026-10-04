package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 一次成功的攻击：A 队把 B 队某个服务的 flag 交上来了。
 */
@Entity
@Table(name = "awx_attacks", indexes = @Index(name = "idx_awx_attacks_round", columnList = "round_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AwxAttack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "round_id", nullable = false)
    private Long roundId;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    @Column(name = "attacker_team_id", nullable = false)
    private Long attackerTeamId;

    @Column(name = "attacker_user_id")
    private Long attackerUserId;

    @Column(name = "victim_target_id", nullable = false)
    private Long victimTargetId;

    @Column(name = "victim_team_id", nullable = false)
    private Long victimTeamId;

    @Column(name = "awx_service_id", nullable = false)
    private Long awxServiceId;

    @Column(nullable = false, length = 512)
    private String flag;

    /** 攻击方加了多少分 */
    @Column(name = "attacker_delta", nullable = false)
    private Integer attackerDelta;

    /** 被攻破方扣了多少分（负数） */
    @Column(name = "victim_delta", nullable = false)
    private Integer victimDelta;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

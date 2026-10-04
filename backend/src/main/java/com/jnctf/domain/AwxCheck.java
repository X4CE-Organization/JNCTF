package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 一次服务可用性检查（checker）结果。
 */
@Entity
@Table(name = "awx_checks", indexes = @Index(name = "idx_awx_checks_round", columnList = "round_id, team_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AwxCheck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "round_id", nullable = false)
    private Long roundId;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    @Column(name = "awx_service_id", nullable = false)
    private Long awxServiceId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(nullable = false)
    private Boolean passed;

    /** 分数增减 */
    @Column(nullable = false)
    @Builder.Default
    private Integer delta = 0;

    @Column(length = 500)
    private String message;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

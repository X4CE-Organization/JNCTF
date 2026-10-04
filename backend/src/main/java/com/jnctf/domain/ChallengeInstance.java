package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 动态靶机实例：每个用户/队伍一份独立容器。
 */
@Entity
@Table(name = "challenge_instances", indexes = {
        @Index(name = "idx_instances_user_challenge", columnList = "user_id, challenge_id"),
        @Index(name = "idx_instances_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChallengeInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenge_id", nullable = false)
    private Long challengeId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "competition_id", nullable = false)
    @Builder.Default
    private Long competitionId = 0L;

    @Column(name = "container_id", length = 128)
    private String containerId;

    @Column(length = 128)
    private String host;

    private Integer port;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private InstanceStatus status = InstanceStatus.CREATING;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    /** 该实例专属的 flag（动态题用） */
    @Column(name = "instance_flag", length = 512)
    private String instanceFlag;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

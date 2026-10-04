package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 某支队伍某个服务的实例。
 */
@Entity
@Table(name = "awx_targets", uniqueConstraints = @UniqueConstraint(columnNames = {"awx_service_id", "team_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AwxTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    @Column(name = "awx_service_id", nullable = false)
    private Long awxServiceId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

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

    /** 该靶机当前回合的 flag（只有本人和管理员看得到） */
    @Column(name = "current_flag", length = 512)
    private String currentFlag;

    /** 连续检查失败次数，达到阈值判定宕机 */
    @Column(name = "fail_streak", nullable = false)
    @Builder.Default
    private Integer failStreak = 0;

    /** 存活即可拿分？ */
    @Column(nullable = false)
    @Builder.Default
    private Boolean alive = true;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

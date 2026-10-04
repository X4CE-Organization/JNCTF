package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "challenges", indexes = {
        @Index(name = "idx_challenges_category", columnList = "category_id"),
        @Index(name = "idx_challenges_state", columnList = "state")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Challenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 160)
    private String title;

    /** 题面，Markdown */
    @Column(columnDefinition = "text")
    private String description;

    /** 解题提示（公开可见，和要花积分解锁的 Hint 不同） */
    @Column(columnDefinition = "text")
    private String hintPreview;

    @Column(name = "category_id")
    private Long categoryId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Difficulty difficulty = Difficulty.EASY;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private ChallengeState state = ChallengeState.VISIBLE;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_type", nullable = false, length = 16)
    @Builder.Default
    private ScoringType scoringType = ScoringType.STATIC;

    /** 基础分 / 动态分的最高分 */
    @Column(nullable = false)
    @Builder.Default
    private Integer score = 100;

    /** 动态分的最低分 */
    @Column(name = "min_score", nullable = false)
    @Builder.Default
    private Integer minScore = 20;

    /** 动态分衰减系数，越小掉得越快 */
    @Column(name = "decay", nullable = false)
    @Builder.Default
    private Integer decay = 30;

    @Column(name = "author_id")
    private Long authorId;

    @Column(name = "solve_count", nullable = false)
    @Builder.Default
    private Integer solveCount = 0;

    @Column(name = "attempt_count", nullable = false)
    @Builder.Default
    private Integer attemptCount = 0;

    /** 单用户最大提交次数，0 = 不限 */
    @Column(name = "max_attempts", nullable = false)
    @Builder.Default
    private Integer maxAttempts = 0;

    /** 是否需要平台起一个独立容器（动态靶机） */
    @Column(name = "requires_container", nullable = false)
    @Builder.Default
    private Boolean requiresContainer = false;

    @Column(name = "docker_image", length = 255)
    private String dockerImage;

    /** 容器内暴露的端口 */
    @Column(name = "container_port")
    private Integer containerPort;

    /** tcp / http，决定前端给的连接方式 */
    @Column(name = "connection_type", length = 16)
    @Builder.Default
    private String connectionType = "tcp";

    /** 手工题（不自动起容器）时给出的连接信息模板 */
    @Column(name = "connection_info", columnDefinition = "text")
    private String connectionInfo;

    @Column(name = "cpu_limit", length = 16)
    @Builder.Default
    private String cpuLimit = "0.5";

    @Column(name = "memory_limit_mb", nullable = false)
    @Builder.Default
    private Integer memoryLimitMb = 256;

    /** 容器存活时间（秒） */
    @Column(name = "instance_ttl_seconds", nullable = false)
    @Builder.Default
    private Integer instanceTtlSeconds = 3600;

    /** 是否允许下载附件 */
    @Column(name = "allow_download", nullable = false)
    @Builder.Default
    private Boolean allowDownload = true;

    /** 是否允许比赛结束后公开题解 */
    @Column(name = "allow_writeup", nullable = false)
    @Builder.Default
    private Boolean allowWriteup = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}

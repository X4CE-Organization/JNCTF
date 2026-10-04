package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "competitions", indexes = {
        @Index(name = "idx_competitions_time", columnList = "start_at, end_at")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Competition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(length = 255)
    private String subtitle;

    @Column(columnDefinition = "text")
    private String description;

    /** 比赛规则，Markdown */
    @Column(columnDefinition = "text")
    private String rules;

    @Column(length = 512)
    private String banner;

    @Column(nullable = false, length = 16, unique = true)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private CompetitionType type = CompetitionType.JEOPARDY;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private CompetitionState state = CompetitionState.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "team_mode", nullable = false, length = 16)
    @Builder.Default
    private TeamMode teamMode = TeamMode.BOTH;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    /** 封榜时间，null = 不封榜 */
    @Column(name = "freeze_at")
    private Instant freezeAt;

    /** 是否公开可见 */
    @Column(nullable = false)
    @Builder.Default
    private Boolean published = false;

    /** 报名口令，空 = 不需要 */
    @Column(name = "join_password", length = 64)
    private String joinPassword;

    /** 报名人数上限，0 = 不限 */
    @Column(name = "max_participants", nullable = false)
    @Builder.Default
    private Integer maxParticipants = 0;

    @Column(name = "min_team_size", nullable = false)
    @Builder.Default
    private Integer minTeamSize = 1;

    @Column(name = "max_team_size", nullable = false)
    @Builder.Default
    private Integer maxTeamSize = 4;

    /** 参赛是否需要管理员审核 */
    @Column(name = "need_approval", nullable = false)
    @Builder.Default
    private Boolean needApproval = false;

    /** 封榜后是否对参赛者隐藏实时榜 */
    @Column(name = "hide_scoreboard", nullable = false)
    @Builder.Default
    private Boolean hideScoreboard = false;

    /** 是否在比赛开始时隐藏题目，到点才放出 */
    @Column(name = "hide_challenges", nullable = false)
    @Builder.Default
    private Boolean hideChallenges = false;

    /** 允许赛后自由练习（题目并入题库） */
    @Column(name = "practice_after", nullable = false)
    @Builder.Default
    private Boolean practiceAfter = true;

    /** AWD：每回合时长（秒） */
    @Column(name = "awd_round_seconds", nullable = false)
    @Builder.Default
    private Integer awdRoundSeconds = 300;

    /** AWD：每个 flag 被攻破的得分 */
    @Column(name = "awd_attack_score", nullable = false)
    @Builder.Default
    private Integer awdAttackScore = 50;

    /** AWD：被攻破的扣分 */
    @Column(name = "awd_defense_penalty", nullable = false)
    @Builder.Default
    private Integer awdDefensePenalty = 50;

    @Column(name = "created_by")
    private Long createdBy;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

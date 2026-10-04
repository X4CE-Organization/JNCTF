package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 一次「做出来」的记录。提交只是流水，Solve 才是计分依据。
 */
@Entity
@Table(name = "solves", uniqueConstraints = {
        @UniqueConstraint(name = "uk_solve_user", columnNames = {"user_id", "challenge_id", "competition_id"})
}, indexes = {
        @Index(name = "idx_solves_challenge", columnList = "challenge_id"),
        @Index(name = "idx_solves_user", columnList = "user_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Solve {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenge_id", nullable = false)
    private Long challengeId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "team_id")
    private Long teamId;

    /** 练习模式下为 0 */
    @Column(name = "competition_id", nullable = false)
    @Builder.Default
    private Long competitionId = 0L;

    @Column(nullable = false)
    private Integer score;

    /** 一血 */
    @Column(name = "first_blood", nullable = false)
    @Builder.Default
    private Boolean firstBlood = false;

    /** 二血 */
    @Column(name = "second_blood", nullable = false)
    @Builder.Default
    private Boolean secondBlood = false;

    /** 三血 */
    @Column(name = "third_blood", nullable = false)
    @Builder.Default
    private Boolean thirdBlood = false;

    /** 从提交开始到解出的秒数（比赛内） */
    @Column(name = "solve_seconds")
    private Long solveSeconds;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

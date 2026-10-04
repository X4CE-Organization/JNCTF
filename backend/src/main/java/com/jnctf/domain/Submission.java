package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "submissions", indexes = {
        @Index(name = "idx_submissions_user", columnList = "user_id, id"),
        @Index(name = "idx_submissions_challenge", columnList = "challenge_id, id"),
        @Index(name = "idx_submissions_competition", columnList = "competition_id, id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Submission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenge_id", nullable = false)
    private Long challengeId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "competition_id")
    private Long competitionId;

    @Column(nullable = false, length = 512)
    private String flag;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SubmissionStatus status;

    /** 正确时给出的分数 */
    @Column(nullable = false)
    @Builder.Default
    private Integer score = 0;

    @Column(length = 64)
    private String ip;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

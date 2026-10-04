package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "competition_participants", uniqueConstraints = {
        @UniqueConstraint(name = "uk_comp_user", columnNames = {"competition_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompetitionParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 个人赛为 null */
    @Column(name = "team_id")
    private Long teamId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private ParticipantStatus status = ParticipantStatus.APPROVED;

    /** 该场比赛内的分数 */
    @Column(nullable = false)
    @Builder.Default
    private Integer score = 0;

    @Column(name = "last_solve_at")
    private Instant lastSolveAt;

    @Column(nullable = false)
    @Builder.Default
    private Boolean banned = false;

    @Column(name = "registered_at", nullable = false)
    @Builder.Default
    private Instant registeredAt = Instant.now();
}

package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "competition_challenges", uniqueConstraints = @UniqueConstraint(columnNames = {"competition_id", "challenge_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompetitionChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    @Column(name = "challenge_id", nullable = false)
    private Long challengeId;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    /** 覆盖题目自带分值，null = 用题目自己的 */
    @Column(name = "custom_score")
    private Integer customScore;
}

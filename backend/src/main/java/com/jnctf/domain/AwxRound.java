package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * AWD 的一个回合。每回合重新下发 flag，结算一次攻防得分。
 */
@Entity
@Table(name = "awx_rounds", uniqueConstraints = @UniqueConstraint(columnNames = {"competition_id", "round_no"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AwxRound {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    @Column(name = "round_no", nullable = false)
    private Integer roundNo;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private AwxRoundState state = AwxRoundState.PENDING;

    /** 本回合已结算 */
    @Column(nullable = false)
    @Builder.Default
    private Boolean settled = false;
}

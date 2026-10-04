package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 每回合下发给每个靶机的 flag。
 */
@Entity
@Table(name = "awx_flags", indexes = {
        @Index(name = "idx_awx_flags_value", columnList = "flag"),
        @Index(name = "idx_awx_flags_round", columnList = "round_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AwxFlag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "round_id", nullable = false)
    private Long roundId;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(nullable = false, length = 512, unique = true)
    private String flag;

    /** 被别的队伍拿到几次 */
    @Column(name = "captured_count", nullable = false)
    @Builder.Default
    private Integer capturedCount = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean expired = false;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

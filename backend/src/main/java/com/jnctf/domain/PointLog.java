package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 积分流水：加减分都留痕，方便选手对账。
 */
@Entity
@Table(name = "point_logs", indexes = @Index(name = "idx_point_logs_user", columnList = "user_id, id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PointLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Integer delta;

    @Column(nullable = false)
    private Integer balance;

    @Column(nullable = false, length = 120)
    private String reason;

    @Column(name = "ref_type", length = 32)
    private String refType;

    @Column(name = "ref_id")
    private Long refId;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

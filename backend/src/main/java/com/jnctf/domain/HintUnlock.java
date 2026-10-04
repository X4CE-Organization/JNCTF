package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "hint_unlocks", uniqueConstraints = @UniqueConstraint(columnNames = {"hint_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HintUnlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "hint_id", nullable = false)
    private Long hintId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "team_id")
    private Long teamId;

    @Column(nullable = false)
    @Builder.Default
    private Integer cost = 0;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

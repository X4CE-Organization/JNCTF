package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "challenge_flags")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChallengeFlag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenge_id", nullable = false)
    private Long challengeId;

    @Column(nullable = false, length = 512)
    private String flag;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private FlagType type = FlagType.STATIC;

    @Column(name = "case_sensitive", nullable = false)
    @Builder.Default
    private Boolean caseSensitive = true;
}

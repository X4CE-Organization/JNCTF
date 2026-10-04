package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "challenge_files")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChallengeFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenge_id", nullable = false)
    private Long challengeId;

    @Column(nullable = false, length = 255)
    private String filename;

    @Column(nullable = false, length = 512)
    private String url;

    @Column(nullable = false)
    @Builder.Default
    private Long size = 0L;

    @Column(length = 64)
    private String sha256;

    @Column(nullable = false)
    @Builder.Default
    private Integer downloads = 0;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

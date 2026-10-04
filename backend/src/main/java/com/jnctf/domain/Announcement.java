package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "announcements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** INFO / WARNING / IMPORTANT */
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String level = "INFO";

    @Column(nullable = false)
    @Builder.Default
    private Boolean pinned = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean visible = true;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "published_at", nullable = false)
    @Builder.Default
    private Instant publishedAt = Instant.now();
}

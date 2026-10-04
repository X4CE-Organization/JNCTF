package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 定向邀请码：队长可以生成一次性邀请发给指定的人。
 */
@Entity
@Table(name = "team_invites")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(nullable = false, length = 32, unique = true)
    private String code;

    /** 指定给某个用户，null = 谁拿到都能用 */
    @Column(name = "target_user_id")
    private Long targetUserId;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "used_by")
    private Long usedBy;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

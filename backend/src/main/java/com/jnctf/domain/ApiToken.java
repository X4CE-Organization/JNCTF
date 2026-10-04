package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 给自动化工具/脚本用的长期令牌（比如批量交 flag 的 CLI）。
 */
@Entity
@Table(name = "api_tokens", indexes = @Index(name = "idx_api_tokens_hash", columnList = "token_hash"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 64)
    private String name;

    /** 只存哈希，明文只在创建时返回一次 */
    @Column(name = "token_hash", nullable = false, length = 128, unique = true)
    private String tokenHash;

    /** 前缀，方便识别 */
    @Column(length = 16)
    private String prefix;

    /** 逗号分隔的权限范围，空 = 全部 */
    @Column(length = 255)
    private String scopes;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(nullable = false)
    @Builder.Default
    private Boolean revoked = false;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

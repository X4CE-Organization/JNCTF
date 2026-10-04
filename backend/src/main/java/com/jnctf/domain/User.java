package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_users_username", columnList = "username", unique = true),
        @Index(name = "idx_users_email", columnList = "email", unique = true),
        @Index(name = "idx_users_score", columnList = "score")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32, unique = true)
    private String username;

    @Column(length = 128, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "display_name", length = 48)
    private String displayName;

    @Column(length = 512)
    private String avatar;

    @Column(length = 512)
    private String bio;

    @Column(length = 128)
    private String website;

    @Column(length = 64)
    private String country;

    @Column(length = 32)
    private String organization;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private UserRole role = UserRole.USER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;

    /** 总积分（所有比赛/题目累计） */
    @Column(nullable = false)
    @Builder.Default
    private Integer score = 0;

    @Column(name = "email_verified", nullable = false)
    @Builder.Default
    private Boolean emailVerified = false;

    /** 两步验证密钥，开启后才写入 */
    @Column(name = "totp_secret", length = 64)
    private String totpSecret;

    @Column(name = "totp_enabled", nullable = false)
    @Builder.Default
    private Boolean totpEnabled = false;

    /** 在榜上隐藏自己（管理员用） */
    @Column(nullable = false)
    @Builder.Default
    private Boolean hidden = false;

    /** 站内禁止提交（作弊处理） */
    @Column(nullable = false)
    @Builder.Default
    private Boolean banned = false;

    @Column(name = "ban_reason", length = 255)
    private String banReason;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "last_login_ip", length = 64)
    private String lastLoginIp;

    /** 语言偏好 */
    @Column(length = 8)
    @Builder.Default
    private String locale = "zh-CN";

    @Column(nullable = false)
    @Builder.Default
    private Boolean newsletter = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Transient
    public String getEffectiveName() {
        return displayName == null || displayName.isBlank() ? username : displayName;
    }
}

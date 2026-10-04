package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "teams", indexes = {
        @Index(name = "idx_teams_name", columnList = "name", unique = true),
        @Index(name = "idx_teams_score", columnList = "score")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 48, unique = true)
    private String name;

    @Column(length = 32)
    private String affiliation;

    @Column(length = 1000)
    private String description;

    @Column(length = 512)
    private String avatar;

    @Column(length = 128)
    private String website;

    /** 邀请码，队长可重置 */
    @Column(name = "invite_code", length = 32, unique = true)
    private String inviteCode;

    /** 是否允许任何人用邀请码加入 */
    @Column(name = "open_join", nullable = false)
    @Builder.Default
    private Boolean openJoin = true;

    @Column(nullable = false)
    @Builder.Default
    private Integer score = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean hidden = false;

    /** 锁定的队伍不能改成员（比赛进行中常见） */
    @Column(nullable = false)
    @Builder.Default
    private Boolean locked = false;

    @Column(name = "captain_id", nullable = false)
    private Long captainId;

    @Column(nullable = false)
    @Builder.Default
    private Boolean banned = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

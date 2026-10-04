package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "tickets", indexes = @Index(name = "idx_tickets_status", columnList = "status, id"))
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String subject;

    /** 分类：题目问题 / 账号问题 / 比赛问题 / 举报作弊 / 其它 */
    @Column(nullable = false, length = 32)
    @Builder.Default
    private String category = "OTHER";

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String priority = "NORMAL";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private TicketStatus status = TicketStatus.OPEN;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "assignee_id")
    private Long assigneeId;

    /** 关联对象，比如某道题 */
    @Column(name = "ref_type", length = 32)
    private String refType;

    @Column(name = "ref_id")
    private Long refId;

    @Column(name = "last_reply_at")
    private Instant lastReplyAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}

package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 通用上传记录，头像 / 题面图片 / 附件都走这里。
 */
@Entity
@Table(name = "attachments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String filename;

    /** 存到磁盘上的相对路径 */
    @Column(nullable = false, length = 512)
    private String path;

    @Column(nullable = false, length = 512)
    private String url;

    @Column(name = "content_type", length = 128)
    private String contentType;

    @Column(nullable = false)
    @Builder.Default
    private Long size = 0L;

    @Column(length = 64)
    private String sha256;

    /** 上传者 */
    @Column(name = "user_id")
    private Long userId;

    /** 用途：avatar / challenge / banner / writeup / other */
    @Column(length = 32)
    @Builder.Default
    private String scope = "other";

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

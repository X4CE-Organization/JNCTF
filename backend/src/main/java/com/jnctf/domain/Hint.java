package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "hints")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Hint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenge_id", nullable = false)
    private Long challengeId;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** 解锁要扣的积分，0 = 免费 */
    @Column(nullable = false)
    @Builder.Default
    private Integer cost = 0;

    /** 扣分是否从题目分里扣（否则只扣总积分） */
    @Column(name = "deduct_from_challenge", nullable = false)
    @Builder.Default
    private Boolean deductFromChallenge = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;
}

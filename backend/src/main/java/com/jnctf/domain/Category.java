package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 48)
    private String name;

    @Column(nullable = false, length = 48, unique = true)
    private String slug;

    @Column(length = 255)
    private String description;

    /** 图标名，前端图标库里取 */
    @Column(length = 32)
    private String icon;

    @Column(length = 16)
    private String color;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean visible = true;
}

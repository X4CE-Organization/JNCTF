package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tags")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 48, unique = true)
    private String name;

    @Column(length = 16)
    private String color;

    @Column(nullable = false)
    @Builder.Default
    private Integer usageCount = 0;
}

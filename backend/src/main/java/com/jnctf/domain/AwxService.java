package com.jnctf.domain;

import jakarta.persistence.*;
import lombok.*;

/**
 * 一个被攻击的服务（AWD 靶机模板）。
 */
@Entity
@Table(name = "awx_services")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AwxService {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    /** 同时挂一个题面，方便选手看说明 */
    @Column(name = "challenge_id")
    private Long challengeId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "docker_image", nullable = false, length = 255)
    private String dockerImage;

    /** 容器里对外暴露的端口 */
    @Column(name = "internal_port", nullable = false)
    private Integer internalPort;

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String protocol = "tcp";

    /** 每回合重置容器的命令，留空则只换 flag */
    @Column(name = "reset_command", length = 512)
    private String resetCommand;

    /** flag 写入容器的方式：环境变量名或文件路径 */
    @Column(name = "flag_env", length = 64)
    @Builder.Default
    private String flagEnv = "FLAG";

    @Column(name = "flag_file", length = 255)
    private String flagFile;

    /** flag 模板，支持 {team} {round} {random} */
    @Column(name = "flag_template", nullable = false, length = 255)
    @Builder.Default
    private String flagTemplate = "flag{{{random}}}";

    /** 健康检查用的 HTTP 路径或 TCP 探测 */
    @Column(name = "check_path", length = 255)
    private String checkPath;

    /** 检查脚本，留空则只做端口存活探测 */
    @Column(name = "checker_script", columnDefinition = "text")
    private String checkerScript;

    /** 每回合基础分 */
    @Column(name = "base_score", nullable = false)
    @Builder.Default
    private Integer baseScore = 0;

    @Column(name = "cpu_limit", length = 16)
    @Builder.Default
    private String cpuLimit = "1";

    @Column(name = "memory_limit_mb", nullable = false)
    @Builder.Default
    private Integer memoryLimitMb = 512;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;
}

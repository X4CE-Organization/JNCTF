package com.jnctf.config;

import com.jnctf.domain.Category;
import com.jnctf.domain.User;
import com.jnctf.domain.UserRole;
import com.jnctf.domain.UserStatus;
import com.jnctf.repository.CategoryRepository;
import com.jnctf.repository.UserRepository;
import com.jnctf.service.SettingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

/**
 * 首次启动时准备最小可用数据：
 *   - 一个超级管理员（账号密码来自配置，登录后请立刻改）
 *   - 常见题目分类
 * 已经初始化过就什么都不做，不会覆盖已有数据。
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final PasswordEncoder passwordEncoder;
    private final SettingService settingService;
    private final JnctfProperties properties;

    @Bean
    public ApplicationRunner initializeData() {
        return args -> {
            settingService.warmUp();
            seedRootUser();
            seedCategories();
        };
    }

    private void seedRootUser() {
        if (userRepository.count() > 0) {
            return;
        }
        JnctfProperties.Init init = properties.getInit();
        User root = User.builder()
                .username(init.getUsername())
                .email(init.getEmail())
                .passwordHash(passwordEncoder.encode(init.getPassword()))
                .displayName(init.getUsername())
                .role(UserRole.SUPER_ADMIN)
                .status(UserStatus.ACTIVE)
                .emailVerified(true)
                .build();
        userRepository.save(root);
        log.warn("已创建超级管理员「{}」，请登录后立刻修改密码", init.getUsername());
    }

    private void seedCategories() {
        if (categoryRepository.count() > 0) {
            return;
        }
        List<Category> categories = List.of(
                category("Web", "web", "Web 安全", "globe", "#3b82f6", 1),
                category("Pwn", "pwn", "二进制漏洞利用", "cpu", "#ef4444", 2),
                category("Reverse", "reverse", "逆向工程", "search", "#a855f7", 3),
                category("Crypto", "crypto", "密码学", "key", "#f59e0b", 4),
                category("Misc", "misc", "杂项", "sparkles", "#22c55e", 5),
                category("Forensics", "forensics", "取证分析", "file", "#06b6d4", 6),
                category("Blockchain", "blockchain", "区块链", "link", "#8b5cf6", 7),
                category("AWD", "awd", "攻防对抗", "shield", "#f43f5e", 8)
        );
        categoryRepository.saveAll(categories);
        log.info("已初始化 {} 个题目分类", categories.size());
    }

    private Category category(String name, String slug, String description, String icon, String color, int order) {
        return Category.builder()
                .name(name)
                .slug(slug)
                .description(description)
                .icon(icon)
                .color(color)
                .sortOrder(order)
                .visible(true)
                .build();
    }
}

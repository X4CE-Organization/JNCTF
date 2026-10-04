package com.jnctf.config;

import com.jnctf.common.ApiResponse;
import com.jnctf.security.JwtAuthenticationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * 安全配置。
 *
 * 接口权限按前缀分档：
 *   /api/admin/**   需要 ADMIN 及以上
 *   /api/super/**   需要 SUPER_ADMIN
 *   其余 /api/**    默认放行，由 @PreAuthorize 或业务代码再判断
 * 这样新增接口时不会因为忘了配规则而意外暴露管理能力。
 */
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 静态资源与前端
                        .requestMatchers("/", "/index.html", "/assets/**", "/favicon.ico", "/uploads/**").permitAll()
                        // 健康检查与接口文档
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        // 登录注册等公开接口
                        .requestMatchers(
                                "/api/auth/register",
                                "/api/auth/login",
                                "/api/auth/refresh",
                                "/api/auth/forgot-password",
                                "/api/auth/reset-password",
                                "/api/auth/verify-email",
                                "/api/auth/check-username",
                                "/api/auth/check-email",
                                "/api/auth/captcha",
                                "/api/auth/oauth/**"
                        ).permitAll()
                        // 游客可读的公开数据
                        .requestMatchers(HttpMethod.GET,
                                "/api/site/**",
                                "/api/challenges",
                                "/api/challenges/*",
                                "/api/categories",
                                "/api/scoreboard/**",
                                "/api/competitions",
                                "/api/competitions/*",
                                "/api/competitions/*/scoreboard",
                                "/api/competitions/*/challenges",
                                "/api/announcements",
                                "/api/users/*/profile",
                                "/api/teams/*",
                                "/api/writeups",
                                "/api/writeups/*"
                        ).permitAll()
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/super/**").hasRole("SUPER_ADMIN")
                        .anyRequest().authenticated())
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint((request, response, ex) -> write(response, 401, "请先登录"))
                        .accessDeniedHandler((request, response, ex) -> write(response, 403, "没有权限执行该操作")))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Content-Disposition"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private void write(jakarta.servlet.http.HttpServletResponse response, int status, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        String code = status == 401 ? "UNAUTHORIZED" : "FORBIDDEN";
        objectMapper.writeValue(response.getWriter(), ApiResponse.fail(code, message));
    }
}

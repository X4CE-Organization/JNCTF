package com.jnctf.security;

import com.jnctf.domain.ApiToken;
import com.jnctf.domain.User;
import com.jnctf.repository.ApiTokenRepository;
import com.jnctf.repository.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

/**
 * 每个请求解析一次身份，支持两种凭证：
 *   - {@code Authorization: Bearer <jwt>}      浏览器用
 *   - {@code Authorization: Token <api-token>} 脚本 / CI 用
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ApiTokenRepository apiTokenRepository;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            resolve(request).ifPresent(principal -> {
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            });
        }
        chain.doFilter(request, response);
    }

    private Optional<UserPrincipal> resolve(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || header.isBlank()) {
            return Optional.empty();
        }
        if (header.regionMatches(true, 0, "Token ", 0, 6)) {
            return resolveApiToken(header.substring(6).trim(), request);
        }
        if (!header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return Optional.empty();
        }
        String token = header.substring(7).trim();
        try {
            Claims claims = jwtService.parse(token);
            if (!"access".equals(claims.get("typ", String.class))) {
                return Optional.empty();
            }
            return userRepository.findById(Long.valueOf(claims.getSubject()))
                    .filter(user -> !Boolean.TRUE.equals(user.getBanned()))
                    .map(UserPrincipal::new);
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private Optional<UserPrincipal> resolveApiToken(String raw, HttpServletRequest request) {
        if (raw.isEmpty()) {
            return Optional.empty();
        }
        ApiToken token = apiTokenRepository.findByTokenHashAndRevokedFalse(sha256(raw)).orElse(null);
        if (token == null || (token.getExpiresAt() != null && token.getExpiresAt().isBefore(Instant.now()))) {
            return Optional.empty();
        }
        User user = userRepository.findById(token.getUserId()).orElse(null);
        if (user == null || Boolean.TRUE.equals(user.getBanned())) {
            return Optional.empty();
        }
        // lastUsedAt 不必每次请求都写库，5 分钟更新一次够了
        Instant now = Instant.now();
        if (token.getLastUsedAt() == null || token.getLastUsedAt().isBefore(now.minusSeconds(300))) {
            token.setLastUsedAt(now);
            apiTokenRepository.save(token);
        }
        return Optional.of(new UserPrincipal(user));
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}

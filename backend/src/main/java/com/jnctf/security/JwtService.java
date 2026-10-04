package com.jnctf.security;

import com.jnctf.config.JnctfProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

/**
 * 签发与校验 JWT。
 *
 * 访问令牌短、刷新令牌长；刷新令牌额外带一个 typ=refresh 声明，避免被当成访问令牌用。
 */
@Service
@RequiredArgsConstructor
public class JwtService {

    private final JnctfProperties properties;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(properties.getJwt().getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String issueAccessToken(Long userId, String username, String role) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(properties.getJwt().getAccessTokenMinutes() * 60L);
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claims(Map.of("username", username, "role", role, "typ", "access"))
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key())
                .compact();
    }

    public String issueRefreshToken(Long userId) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(properties.getJwt().getRefreshTokenDays() * 86400L);
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .id(UUID.randomUUID().toString())
                .claims(Map.of("typ", "refresh"))
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key())
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
    }

    public Long parseUserId(String token) {
        try {
            return Long.valueOf(parse(token).getSubject());
        } catch (JwtException | IllegalArgumentException ex) {
            return null;
        }
    }

    public boolean isRefreshToken(String token) {
        try {
            return "refresh".equals(parse(token).get("typ", String.class));
        } catch (JwtException | IllegalArgumentException ex) {
            return false;
        }
    }

    public long accessTokenSeconds() {
        return properties.getJwt().getAccessTokenMinutes() * 60L;
    }
}

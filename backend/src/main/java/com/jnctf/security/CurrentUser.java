package com.jnctf.security;

import com.jnctf.common.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/**
 * 取当前登录用户的工具。没登录时 {@code require()} 抛 401，{@code orNull()} 返回空。
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Optional<UserPrincipal> orNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            return Optional.empty();
        }
        return Optional.of(principal);
    }

    public static UserPrincipal require() {
        return orNull().orElseThrow(() -> ApiException.unauthorized("请先登录"));
    }

    public static Long idOrNull() {
        return orNull().map(UserPrincipal::getId).orElse(null);
    }
}

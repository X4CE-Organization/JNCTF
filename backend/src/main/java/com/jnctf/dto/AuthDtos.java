package com.jnctf.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 认证相关的请求 / 响应。
 */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "不能为空") @Size(min = 3, max = 20, message = "长度需在 3-20 之间") String username,
            @NotBlank(message = "不能为空") @Size(min = 8, max = 64, message = "长度需在 8-64 之间") String password,
            @Email(message = "格式不正确") String email,
            String displayName,
            String inviteCode
    ) {
    }

    public record LoginRequest(
            @NotBlank(message = "不能为空") String username,
            @NotBlank(message = "不能为空") String password,
            /** 两步验证码，开了 2FA 才需要 */
            String totpCode,
            String captcha
    ) {
    }

    public record TokenResponse(
            String accessToken,
            String refreshToken,
            long expiresIn,
            UserSummary user
    ) {
    }

    public record RefreshRequest(@NotBlank(message = "不能为空") String refreshToken) {
    }

    public record UserSummary(
            Long id,
            String username,
            String displayName,
            String avatar,
            String role,
            String status,
            Integer score,
            Boolean totpEnabled,
            Long teamId,
            String teamName,
            java.time.Instant createdAt
    ) {
    }

    public record UpdateProfileRequest(
            String displayName,
            String bio,
            String website,
            String country,
            String organization,
            String avatar,
            String locale
    ) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "不能为空") String currentPassword,
            @NotBlank(message = "不能为空") @Size(min = 8, max = 64, message = "长度需在 8-64 之间") String newPassword
    ) {
    }

    public record ForgotPasswordRequest(@NotBlank(message = "不能为空") String account) {
    }

    public record ResetPasswordRequest(
            @NotBlank(message = "不能为空") String token,
            @NotBlank(message = "不能为空") @Size(min = 8, message = "至少 8 位") String newPassword
    ) {
    }

    public record TwoFactorSetupResponse(String secret, String otpauthUrl) {
    }

    public record TwoFactorVerifyRequest(@NotBlank(message = "不能为空") String code) {
    }
}

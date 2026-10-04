package com.jnctf.controller;

import com.jnctf.common.ApiResponse;
import com.jnctf.domain.User;
import com.jnctf.dto.AuthDtos;
import com.jnctf.repository.UserRepository;
import com.jnctf.security.CurrentUser;
import com.jnctf.security.UserPrincipal;
import com.jnctf.service.AuditService;
import com.jnctf.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 注册 / 登录 / 令牌 / 两步验证 / 找回密码。
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @PostMapping("/register")
    public ApiResponse<AuthDtos.TokenResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest request,
                                                        HttpServletRequest http) {
        AuthDtos.TokenResponse response = authService.register(request);
        auditService.record(http, response.user().id(), response.user().username(),
                "user.register", "user", response.user().id(), null);
        return ApiResponse.ok(response);
    }

    @PostMapping("/login")
    public ApiResponse<AuthDtos.TokenResponse> login(@Valid @RequestBody AuthDtos.LoginRequest request,
                                                     HttpServletRequest http) {
        AuthDtos.TokenResponse response = authService.login(request, AuditService.clientIp(http));
        auditService.record(http, response.user().id(), response.user().username(),
                "user.login", "user", response.user().id(), null);
        return ApiResponse.ok(response);
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthDtos.TokenResponse> refresh(@Valid @RequestBody AuthDtos.RefreshRequest request) {
        return ApiResponse.ok(authService.refresh(request.refreshToken()));
    }

    @GetMapping("/me")
    public ApiResponse<AuthDtos.UserSummary> me() {
        UserPrincipal principal = CurrentUser.require();
        User user = userRepository.findById(principal.getId()).orElseThrow();
        return ApiResponse.ok(authService.toSummary(user));
    }

    @PutMapping("/profile")
    public ApiResponse<AuthDtos.UserSummary> updateProfile(@RequestBody AuthDtos.UpdateProfileRequest request) {
        return ApiResponse.ok(authService.updateProfile(CurrentUser.require(), request));
    }

    @PutMapping("/password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody AuthDtos.ChangePasswordRequest request) {
        authService.changePassword(CurrentUser.require(), request);
        return ApiResponse.ok();
    }

    @GetMapping("/check-username")
    public ApiResponse<Boolean> checkUsername(@RequestParam String username) {
        return ApiResponse.ok(!userRepository.existsByUsername(username == null ? "" : username.trim()));
    }

    @GetMapping("/check-email")
    public ApiResponse<Boolean> checkEmail(@RequestParam String email) {
        return ApiResponse.ok(!userRepository.existsByEmail(email == null ? "" : email.trim().toLowerCase()));
    }

    /* ------------------------------------------------------------ 两步验证 */

    @PostMapping("/2fa/setup")
    public ApiResponse<AuthDtos.TwoFactorSetupResponse> setupTwoFactor() {
        return ApiResponse.ok(authService.setupTwoFactor(CurrentUser.require()));
    }

    @PostMapping("/2fa/enable")
    public ApiResponse<Void> enableTwoFactor(@Valid @RequestBody AuthDtos.TwoFactorVerifyRequest request) {
        authService.enableTwoFactor(CurrentUser.require(), request.code());
        return ApiResponse.ok();
    }

    @PostMapping("/2fa/disable")
    public ApiResponse<Void> disableTwoFactor(@Valid @RequestBody AuthDtos.TwoFactorVerifyRequest request) {
        authService.disableTwoFactor(CurrentUser.require(), request.code());
        return ApiResponse.ok();
    }

    /* ---------------------------------------------------------------- 找回 */

    @PostMapping("/forgot-password")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody AuthDtos.ForgotPasswordRequest request) {
        authService.requestPasswordReset(request.account());
        return ApiResponse.ok();
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody AuthDtos.ResetPasswordRequest request) {
        authService.resetPassword(request.token(), request.newPassword());
        return ApiResponse.ok();
    }
}

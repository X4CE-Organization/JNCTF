package com.jnctf.service;

import com.jnctf.common.ApiException;
import com.jnctf.config.JnctfProperties;
import com.jnctf.domain.Team;
import com.jnctf.domain.TeamMember;
import com.jnctf.domain.User;
import com.jnctf.domain.UserRole;
import com.jnctf.domain.UserStatus;
import com.jnctf.dto.AuthDtos;
import com.jnctf.repository.TeamMemberRepository;
import com.jnctf.repository.TeamRepository;
import com.jnctf.repository.UserRepository;
import com.jnctf.security.JwtService;
import com.jnctf.security.TotpService;
import com.jnctf.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 注册、登录、令牌、两步验证与密码找回。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_\\u4e00-\\u9fa5-]{3,20}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TotpService totpService;
    private final SettingService settingService;
    private final NotificationService notificationService;
    private final MailService mailService;
    private final JnctfProperties properties;
    /** 找回密码的一次性令牌放 Redis，30 分钟自动过期 */
    private final StringRedisTemplate redisTemplate;

    private static final String RESET_KEY_PREFIX = "jnctf:reset:";

    /* ---------------------------------------------------------------- 注册 */

    @Transactional
    public AuthDtos.TokenResponse register(AuthDtos.RegisterRequest request) {
        if (!settingService.getBool("site.allow_register")) {
            throw ApiException.forbidden("本站暂未开放注册");
        }
        String username = request.username().trim();
        if (!USERNAME_PATTERN.matcher(username).matches()) {
            throw ApiException.badRequest("用户名只能包含中文、字母、数字、下划线和短横线，长度 3-20");
        }
        if (userRepository.existsByUsername(username)) {
            throw ApiException.conflict("该用户名已被注册");
        }

        String email = request.email() == null ? null : request.email().trim().toLowerCase(Locale.ROOT);
        boolean needEmail = !"none".equals(settingService.get("site.registration_mode"));
        if (needEmail && (email == null || email.isBlank())) {
            throw ApiException.badRequest("本站注册需要填写邮箱");
        }
        if (email != null && !email.isBlank()) {
            if (!EMAIL_PATTERN.matcher(email).matches()) {
                throw ApiException.badRequest("邮箱格式不正确");
            }
            if (userRepository.existsByEmail(email)) {
                throw ApiException.conflict("该邮箱已被注册");
            }
        }

        boolean needVerify = settingService.getBool("site.need_email_verify");
        User user = User.builder()
                .username(username)
                .email(email == null || email.isBlank() ? null : email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .displayName(request.displayName() == null || request.displayName().isBlank()
                        ? username : request.displayName().trim())
                .role(UserRole.USER)
                .status(needVerify ? UserStatus.PENDING : UserStatus.ACTIVE)
                .emailVerified(!needVerify)
                .score(0)
                .build();
        userRepository.save(user);

        notificationService.push(user.getId(), "SYSTEM", "欢迎加入 " + settingService.get("site.name"),
                "你的账号已经创建成功，去看看有哪些题目吧。", "/challenges");
        return issueTokens(user);
    }

    /* ---------------------------------------------------------------- 登录 */

    @Transactional
    public AuthDtos.TokenResponse login(AuthDtos.LoginRequest request, String ip) {
        String account = request.username().trim();
        User user = userRepository.findByUsernameOrEmail(account, account.toLowerCase(Locale.ROOT))
                .orElseThrow(() -> ApiException.unauthorized("用户名或密码不正确"));

        if (Boolean.TRUE.equals(user.getBanned()) || user.getStatus() == UserStatus.BANNED) {
            throw ApiException.forbidden(user.getBanReason() == null ? "账号已被封禁" : user.getBanReason());
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw ApiException.unauthorized("用户名或密码不正确");
        }
        if (Boolean.TRUE.equals(user.getTotpEnabled())) {
            if (request.totpCode() == null || request.totpCode().isBlank()) {
                throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "TOTP_REQUIRED", "请输入两步验证码");
            }
            if (!totpService.verify(user.getTotpSecret(), request.totpCode())) {
                throw ApiException.unauthorized("两步验证码不正确");
            }
        }

        user.setLastLoginAt(Instant.now());
        user.setLastLoginIp(ip);
        userRepository.save(user);
        return issueTokens(user);
    }

    @Transactional(readOnly = true)
    public AuthDtos.TokenResponse refresh(String refreshToken) {
        if (!jwtService.isRefreshToken(refreshToken)) {
            throw ApiException.unauthorized("刷新令牌无效");
        }
        Long userId = jwtService.parseUserId(refreshToken);
        if (userId == null) {
            throw ApiException.unauthorized("刷新令牌无效");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("账号不存在"));
        if (Boolean.TRUE.equals(user.getBanned())) {
            throw ApiException.forbidden("账号已被封禁");
        }
        return issueTokens(user);
    }

    private AuthDtos.TokenResponse issueTokens(User user) {
        String access = jwtService.issueAccessToken(user.getId(), user.getUsername(), user.getRole().name());
        String refresh = jwtService.issueRefreshToken(user.getId());
        return new AuthDtos.TokenResponse(access, refresh, jwtService.accessTokenSeconds(), toSummary(user));
    }

    /* -------------------------------------------------------------- 资料 */

    public AuthDtos.UserSummary toSummary(User user) {
        Long teamId = null;
        String teamName = null;
        Optional<TeamMember> membership = teamMemberRepository.findByUserId(user.getId());
        if (membership.isPresent()) {
            teamId = membership.get().getTeamId();
            teamName = teamRepository.findById(teamId).map(Team::getName).orElse(null);
        }
        return new AuthDtos.UserSummary(
                user.getId(), user.getUsername(), user.getEffectiveName(), user.getAvatar(),
                user.getRole().name(), user.getStatus().name(), user.getScore(),
                user.getTotpEnabled(), teamId, teamName, user.getCreatedAt());
    }

    @Transactional
    public AuthDtos.UserSummary updateProfile(UserPrincipal principal, AuthDtos.UpdateProfileRequest request) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("账号不存在"));
        if (request.displayName() != null) {
            user.setDisplayName(request.displayName().isBlank() ? user.getUsername() : request.displayName().trim());
        }
        if (request.bio() != null) {
            user.setBio(request.bio().length() > 512 ? request.bio().substring(0, 512) : request.bio());
        }
        if (request.website() != null) {
            user.setWebsite(request.website());
        }
        if (request.country() != null) {
            user.setCountry(request.country());
        }
        if (request.organization() != null) {
            user.setOrganization(request.organization());
        }
        if (request.avatar() != null) {
            user.setAvatar(request.avatar());
        }
        if (request.locale() != null && !request.locale().isBlank()) {
            user.setLocale(request.locale());
        }
        userRepository.save(user);
        return toSummary(user);
    }

    @Transactional
    public void changePassword(UserPrincipal principal, AuthDtos.ChangePasswordRequest request) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("账号不存在"));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("当前密码不正确");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    /* ------------------------------------------------------------ 两步验证 */

    @Transactional
    public AuthDtos.TwoFactorSetupResponse setupTwoFactor(UserPrincipal principal) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("账号不存在"));
        String secret = totpService.generateSecret();
        user.setTotpSecret(secret);
        user.setTotpEnabled(false);
        userRepository.save(user);
        String issuer = settingService.get("site.name");
        return new AuthDtos.TwoFactorSetupResponse(secret, totpService.buildOtpAuthUrl(secret, user.getUsername(), issuer));
    }

    @Transactional
    public void enableTwoFactor(UserPrincipal principal, String code) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("账号不存在"));
        if (user.getTotpSecret() == null) {
            throw ApiException.badRequest("请先获取密钥");
        }
        if (!totpService.verify(user.getTotpSecret(), code)) {
            throw ApiException.badRequest("验证码不正确");
        }
        user.setTotpEnabled(true);
        userRepository.save(user);
    }

    @Transactional
    public void disableTwoFactor(UserPrincipal principal, String code) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("账号不存在"));
        if (!totpService.verify(user.getTotpSecret(), code)) {
            throw ApiException.badRequest("验证码不正确");
        }
        user.setTotpEnabled(false);
        user.setTotpSecret(null);
        userRepository.save(user);
    }

    /* -------------------------------------------------------------- 找回 */

    @Transactional
    public void requestPasswordReset(String account) {
        User user = userRepository.findByUsernameOrEmail(account, account.toLowerCase(Locale.ROOT)).orElse(null);
        // 无论账号是否存在都返回成功，避免被用来探测注册用户
        if (user == null || user.getEmail() == null) {
            log.info("找回密码请求：账号不存在或未绑定邮箱 ({})", account);
            return;
        }
        String token = UUID.randomUUID().toString().replace("-", "");
        redisTemplate.opsForValue().set(RESET_KEY_PREFIX + token, String.valueOf(user.getId()), java.time.Duration.ofMinutes(30));
        String link = properties.getSiteUrl() + "/reset-password?token=" + token;
        mailService.send(user.getEmail(), "重置 " + settingService.get("site.name") + " 密码",
                "你好 " + user.getEffectiveName() + "：\n\n点击下面的链接重置密码（30 分钟内有效）：\n" + link
                        + "\n\n如果这不是你本人的操作，请忽略这封邮件。");
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        String key = RESET_KEY_PREFIX + token;
        String userId = redisTemplate.opsForValue().get(key);
        if (userId == null || userId.isBlank()) {
            throw ApiException.badRequest("链接无效或已过期");
        }
        User user = userRepository.findById(Long.valueOf(userId))
                .orElseThrow(() -> ApiException.badRequest("链接无效或已过期"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        redisTemplate.delete(key);
    }

    @Transactional
    public void resetPasswordTo(User user, String rawPassword) {
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        userRepository.save(user);
    }
}

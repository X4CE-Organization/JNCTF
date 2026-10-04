package com.jnctf.service;

import com.jnctf.domain.Setting;
import com.jnctf.repository.SettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 站点设置。
 *
 * 所有可调项在这里声明一次：key、默认值、是否对游客公开。
 * 数据库里没存过的走默认值，所以老库升级不会因为缺设置项报错。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SettingService {

    private final SettingRepository settingRepository;
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    /** key -> 默认值。加新设置项只需要在这里补一行。 */
    public static final Map<String, String> DEFAULTS = new LinkedHashMap<>();

    /** 对游客公开的设置项（前端首屏会用） */
    public static final java.util.Set<String> PUBLIC_KEYS = java.util.Set.of(
            "site.name", "site.description", "site.logo", "site.favicon", "site.footer",
            "site.theme_color", "site.icp", "site.github", "site.allow_register",
            "site.allow_team", "site.need_email_verify", "site.registration_mode",
            "challenge.show_score", "challenge.show_solve_count", "challenge.show_tags",
            "competition.show_upcoming", "scoreboard.freeze_notice", "site.contact_email",
            "site.announcement_banner"
    );

    static {
        DEFAULTS.put("site.name", "JNCTF");
        DEFAULTS.put("site.description", "一个开源的 CTF 竞赛平台");
        DEFAULTS.put("site.logo", "");
        DEFAULTS.put("site.favicon", "");
        DEFAULTS.put("site.footer", "Powered by JNCTF");
        DEFAULTS.put("site.theme_color", "#6366f1");
        DEFAULTS.put("site.icp", "");
        DEFAULTS.put("site.github", "https://github.com/x4ce-organization/JNCTF");
        DEFAULTS.put("site.contact_email", "");
        DEFAULTS.put("site.announcement_banner", "");

        DEFAULTS.put("site.allow_register", "true");
        // none / email / manual —— 注册方式
        DEFAULTS.put("site.registration_mode", "none");
        DEFAULTS.put("site.need_email_verify", "false");
        DEFAULTS.put("site.allow_team", "true");
        DEFAULTS.put("site.max_team_size", "4");
        DEFAULTS.put("site.default_locale", "zh-CN");

        DEFAULTS.put("challenge.show_score", "true");
        DEFAULTS.put("challenge.show_solve_count", "true");
        DEFAULTS.put("challenge.show_tags", "true");
        DEFAULTS.put("challenge.submit_interval_seconds", "5");
        DEFAULTS.put("challenge.wrong_answer_limit", "0");

        DEFAULTS.put("competition.show_upcoming", "true");
        DEFAULTS.put("scoreboard.freeze_notice", "比赛最后 30 分钟封榜，最终排名以结算为准");

        DEFAULTS.put("security.login_fail_limit", "10");
        DEFAULTS.put("security.login_lock_minutes", "15");
        DEFAULTS.put("security.captcha_on_login", "false");
        DEFAULTS.put("security.allow_api_token", "true");

        DEFAULTS.put("upload.max_attachment_mb", "100");
        DEFAULTS.put("upload.max_avatar_mb", "4");

        DEFAULTS.put("docker.enabled", "false");
        DEFAULTS.put("docker.instance_ttl_minutes", "60");
        DEFAULTS.put("docker.max_instance_per_user", "2");
    }

    @Transactional(readOnly = true)
    public String get(String key) {
        String cached = cache.get(key);
        if (cached != null) {
            return cached;
        }
        String value = settingRepository.findById(key).map(Setting::getValue).orElse(DEFAULTS.get(key));
        if (value == null) {
            value = "";
        }
        cache.put(key, value);
        return value;
    }

    public boolean getBool(String key) {
        return Boolean.parseBoolean(get(key));
    }

    public int getInt(String key) {
        try {
            return Integer.parseInt(get(key).trim());
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    /** 全量设置（后台用），数据库里没有的也带上默认值 */
    @Transactional(readOnly = true)
    public Map<String, String> all() {
        Map<String, String> result = new LinkedHashMap<>();
        DEFAULTS.forEach((key, value) -> result.put(key, get(key)));
        settingRepository.findAll().forEach(row -> result.put(row.getKey(), row.getValue()));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, String> publicSettings() {
        Map<String, String> result = new LinkedHashMap<>();
        PUBLIC_KEYS.forEach(key -> result.put(key, get(key)));
        return result;
    }

    @Transactional
    public int update(Map<String, String> patch) {
        int changed = 0;
        for (Map.Entry<String, String> entry : patch.entrySet()) {
            String key = entry.getKey();
            if (!DEFAULTS.containsKey(key)) {
                // 不认识的键直接忽略，防止前端塞垃圾数据
                continue;
            }
            String value = entry.getValue() == null ? "" : entry.getValue();
            Setting setting = settingRepository.findById(key).orElseGet(() -> Setting.builder().key(key).build());
            setting.setValue(value);
            setting.setUpdatedAt(Instant.now());
            settingRepository.save(setting);
            cache.put(key, value);
            changed++;
        }
        return changed;
    }

    @Transactional
    public void reset(java.util.Collection<String> keys) {
        keys.forEach(key -> {
            if (DEFAULTS.containsKey(key)) {
                settingRepository.deleteById(key);
                cache.remove(key);
            }
        });
    }

    /** 启动时把库里的值读进缓存 */
    @Transactional(readOnly = true)
    public void warmUp() {
        cache.clear();
        settingRepository.findAll().forEach(row -> cache.put(row.getKey(), row.getValue()));
        log.info("站点设置已加载 {} 项", cache.size());
    }
}

package com.jnctf.service;

import com.jnctf.domain.AuditLog;
import com.jnctf.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 操作日志。管理员的每个写操作都应该记一笔，方便事后追责。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public void record(HttpServletRequest request, Long actorId, String actorName,
                       String action, String targetType, Object targetId, String detail) {
        try {
            AuditLog entry = AuditLog.builder()
                    .actorId(actorId)
                    .actorName(actorName)
                    .action(action)
                    .targetType(targetType)
                    .targetId(targetId == null ? null : String.valueOf(targetId))
                    .detail(detail != null && detail.length() > 1000 ? detail.substring(0, 1000) : detail)
                    .ip(clientIp(request))
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception ex) {
            // 审计失败不能影响主流程
            log.warn("写入审计日志失败: {}", ex.getMessage());
        }
    }

    public static String clientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}

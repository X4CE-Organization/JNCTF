package com.jnctf.service;

import com.jnctf.domain.Notification;
import com.jnctf.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;

/**
 * 站内通知。重要事件（一血、比赛开始、工单回复、审核结果）都往这里写。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    @Transactional
    public void push(Long userId, String type, String title, String content, String link) {
        if (userId == null) {
            return;
        }
        try {
            notificationRepository.save(Notification.builder()
                    .userId(userId)
                    .type(type)
                    .title(title)
                    .content(content)
                    .link(link)
                    .build());
        } catch (Exception ex) {
            log.warn("写入通知失败: {}", ex.getMessage());
        }
    }

    @Transactional
    public void pushMany(Collection<Long> userIds, String type, String title, String content, String link) {
        userIds.forEach(id -> push(id, type, title, content, link));
    }
}

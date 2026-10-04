package com.jnctf.service;

import com.jnctf.config.JnctfProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * 邮件发送。没配 SMTP 时只写日志，不抛异常——本地开发不该被邮件卡住。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MailService {

    private final JnctfProperties properties;
    private final JavaMailSender mailSender;

    @Async
    public void send(String to, String subject, String body) {
        if (to == null || to.isBlank()) {
            return;
        }
        if (!properties.getMail().isEnabled()) {
            log.info("[邮件未启用] → {} | {} | {}", to, subject, body.replace("\n", " "));
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(properties.getMail().getFrom());
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (Exception ex) {
            log.warn("发送邮件失败 → {}: {}", to, ex.getMessage());
        }
    }
}

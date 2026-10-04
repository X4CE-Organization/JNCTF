package com.jnctf.service;

import com.jnctf.common.ApiException;
import com.jnctf.config.JnctfProperties;
import com.jnctf.domain.Attachment;
import com.jnctf.repository.AttachmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

/**
 * 文件存储：题面附件、头像、比赛横幅都走这里。
 * 文件落在 {@code jnctf.upload-dir} 下，按年月分目录，避免单目录文件过多。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StorageService {

    private final JnctfProperties properties;
    private final AttachmentRepository attachmentRepository;

    @Transactional
    public Attachment store(MultipartFile file, Long userId, String scope) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("请选择要上传的文件");
        }
        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String safeName = original.replaceAll("[\\\\/:*?\"<>|]", "_");
        String extension = safeName.contains(".") ? safeName.substring(safeName.lastIndexOf('.')).toLowerCase(Locale.ROOT) : "";

        try {
            String sub = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
            Path base = Path.of(properties.getUploadDir()).toAbsolutePath().normalize();
            Path directory = base.resolve(sub);
            Files.createDirectories(directory);

            String filename = UUID.randomUUID().toString().replace("-", "") + extension;
            Path target = directory.resolve(filename);
            try (var in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }

            String url = "/uploads/" + sub + "/" + filename;
            Attachment attachment = Attachment.builder()
                    .filename(safeName)
                    .path(target.toString())
                    .url(url)
                    .contentType(file.getContentType())
                    .size(file.getSize())
                    .sha256(sha256(target))
                    .userId(userId)
                    .scope(scope == null ? "other" : scope)
                    .build();
            return attachmentRepository.save(attachment);
        } catch (IOException ex) {
            log.error("保存上传文件失败", ex);
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "文件保存失败");
        }
    }

    public Path resolve(String url) {
        Path base = Path.of(properties.getUploadDir()).toAbsolutePath().normalize();
        String relative = url.startsWith("/uploads/") ? url.substring("/uploads/".length()) : url;
        return base.resolve(relative).normalize();
    }

    public void delete(Attachment attachment) {
        if (attachment == null) {
            return;
        }
        try {
            Files.deleteIfExists(Path.of(attachment.getPath()));
        } catch (IOException ex) {
            log.warn("删除文件失败 {}: {}", attachment.getPath(), ex.getMessage());
        }
        attachmentRepository.delete(attachment);
    }

    private String sha256(Path path) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(Files.readAllBytes(path)));
        } catch (Exception ex) {
            return null;
        }
    }
}

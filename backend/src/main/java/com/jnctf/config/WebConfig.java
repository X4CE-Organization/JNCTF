package com.jnctf.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

/**
 * 上传目录映射成 /uploads/**，前端可以直接引用。
 */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final JnctfProperties properties;

    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        Path dir = Path.of(properties.getUploadDir()).toAbsolutePath().normalize();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + dir + "/");
    }
}

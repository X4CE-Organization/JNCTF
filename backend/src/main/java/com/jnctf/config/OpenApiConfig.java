package com.jnctf.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI jnctfOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("JNCTF API")
                        .version("1.0.0")
                        .description("开源 CTF 平台接口文档。带 Bearer 令牌访问需要登录的接口。"))
                .addSecurityItem(new SecurityRequirement().addList("bearer"))
                .schemaRequirement("bearer", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT"));
    }
}

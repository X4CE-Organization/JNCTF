package com.jnctf.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 启动期配置。运行期可以改的东西都在「系统设置」里，这里只放改一次就固定的参数。
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "jnctf")
public class JnctfProperties {

    /** 站点地址，用于邮件里的链接、OAuth 回调 */
    private String siteUrl = "http://localhost:8080";

    /** 文件上传目录 */
    private String uploadDir = "./data/uploads";

    /** 动态靶机开关与 Docker 连接 */
    private Docker docker = new Docker();

    private Jwt jwt = new Jwt();

    private Mail mail = new Mail();

    /** 首个超级管理员账号，只在数据库为空时创建 */
    private Init init = new Init();

    @Getter
    @Setter
    public static class Docker {
        /** 不接 Docker 时把靶机功能整体关掉 */
        private boolean enabled = false;
        /** Docker daemon 地址，例如 unix:///var/run/docker.sock */
        private String host = "unix:///var/run/docker.sock";
        /** 靶机容器跑在哪个网络 */
        private String network = "jnctf-challenges";
        /** 对外可访问的宿主机地址，前端拼连接串用 */
        private String publicHost = "localhost";
        /** 端口映射范围 */
        private int portRangeStart = 30000;
        private int portRangeEnd = 31000;
    }

    @Getter
    @Setter
    public static class Jwt {
        private String secret = "change-me-to-a-long-random-string-at-least-32-bytes";
        private int accessTokenMinutes = 120;
        private int refreshTokenDays = 14;
        private String issuer = "jnctf";
    }

    @Getter
    @Setter
    public static class Mail {
        /** 关闭时所有邮件只写日志 */
        private boolean enabled = false;
        private String from = "JNCTF <no-reply@localhost>";
    }

    @Getter
    @Setter
    public static class Init {
        private String username = "root";
        private String password = "jnctf123456";
        private String email = "root@jnctf.local";
    }
}

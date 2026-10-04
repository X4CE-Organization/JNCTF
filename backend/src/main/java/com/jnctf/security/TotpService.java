package com.jnctf.security;

import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Locale;

/**
 * TOTP（RFC 6238）两步验证。
 *
 * 直接用 JDK 的 HmacSHA1 实现，不依赖第三方库：
 *   - Base32 编解码自带
 *   - 验证时允许前后各一个时间窗，容忍客户端时钟偏差
 */
@Service
public class TotpService {

    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final int DIGITS = 6;
    private static final int PERIOD = 30;
    private static final int WINDOW = 1;
    private static final SecureRandom RANDOM = new SecureRandom();

    /** 生成一个新的 Base32 密钥（20 字节 = 160 bit，和主流验证器一致） */
    public String generateSecret() {
        byte[] buffer = new byte[20];
        RANDOM.nextBytes(buffer);
        return base32Encode(buffer);
    }

    /** 拼出验证器 App 扫描用的 otpauth 链接 */
    public String buildOtpAuthUrl(String secret, String account, String issuer) {
        String label = urlEncode(issuer + ":" + account);
        return "otpauth://totp/" + label
                + "?secret=" + secret
                + "&issuer=" + urlEncode(issuer)
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + PERIOD;
    }

    /** 校验用户输入的 6 位验证码 */
    public boolean verify(String secret, String code) {
        if (secret == null || code == null || code.isBlank()) {
            return false;
        }
        String normalized = code.replaceAll("\\s", "");
        if (!normalized.matches("\\d{6}")) {
            return false;
        }
        long counter = System.currentTimeMillis() / 1000L / PERIOD;
        for (int offset = -WINDOW; offset <= WINDOW; offset++) {
            if (generateCode(secret, counter + offset).equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    String generateCode(String secret, long counter) {
        try {
            byte[] key = base32Decode(secret);
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(counter).array());
            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7F) << 24)
                    | ((hash[offset + 1] & 0xFF) << 16)
                    | ((hash[offset + 2] & 0xFF) << 8)
                    | (hash[offset + 3] & 0xFF);
            int otp = binary % (int) Math.pow(10, DIGITS);
            return String.format(Locale.ROOT, "%0" + DIGITS + "d", otp);
        } catch (Exception ex) {
            throw new IllegalStateException("生成 TOTP 失败", ex);
        }
    }

    String base32Encode(byte[] data) {
        StringBuilder result = new StringBuilder();
        int buffer = 0;
        int bitsLeft = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                result.append(BASE32_ALPHABET.charAt((buffer >> (bitsLeft - 5)) & 0x1F));
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            result.append(BASE32_ALPHABET.charAt((buffer << (5 - bitsLeft)) & 0x1F));
        }
        return result.toString();
    }

    byte[] base32Decode(String secret) {
        String normalized = secret.trim().replace("=", "").replace(" ", "").toUpperCase(Locale.ROOT);
        int buffer = 0;
        int bitsLeft = 0;
        byte[] out = new byte[normalized.length() * 5 / 8];
        int index = 0;
        for (char c : normalized.toCharArray()) {
            int value = BASE32_ALPHABET.indexOf(c);
            if (value < 0) {
                throw new IllegalArgumentException("非法的 Base32 字符: " + c);
            }
            buffer = (buffer << 5) | value;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out[index++] = (byte) ((buffer >> (bitsLeft - 8)) & 0xFF);
                bitsLeft -= 8;
            }
        }
        return out;
    }

    private String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
    }
}

package com.jnctf.domain;

public enum UserStatus {
    /** 正常 */
    ACTIVE,
    /** 邮件未验证，部分功能受限 */
    PENDING,
    /** 被封禁 */
    BANNED
}

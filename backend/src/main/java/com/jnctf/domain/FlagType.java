package com.jnctf.domain;

public enum FlagType {
    /** 完全匹配 */
    STATIC,
    /** 正则匹配 */
    REGEX,
    /** 每队一题一 flag，提交时校验自己那份 */
    DYNAMIC
}

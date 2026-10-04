package com.jnctf.domain;

public enum ChallengeState {
    /** 可见可提交 */
    VISIBLE,
    /** 只有管理员看得到 */
    HIDDEN,
    /** 可见但已关闭提交 */
    CLOSED
}

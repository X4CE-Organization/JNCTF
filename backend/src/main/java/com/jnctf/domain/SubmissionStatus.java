package com.jnctf.domain;

public enum SubmissionStatus {
    /** 答对了 */
    CORRECT,
    /** 答案不对 */
    WRONG,
    /** 之前已经做出来了 */
    DUPLICATE,
    /** 提交次数超限 */
    RATE_LIMITED,
    /** 题目已关闭 */
    CLOSED
}

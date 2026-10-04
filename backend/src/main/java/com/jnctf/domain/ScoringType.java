package com.jnctf.domain;

public enum ScoringType {
    /** 固定分值 */
    STATIC,
    /** 动态分值：解得人越多分越低，在 max/min 之间按曲线衰减 */
    DYNAMIC
}

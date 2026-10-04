package com.jnctf.domain;

/**
 * 站点角色。权限从低到高，判断时用 {@link #atLeast(UserRole)}。
 */
public enum UserRole {
    /** 普通用户：打比赛、交题、组队 */
    USER,
    /** 普通管理员：管题目、管比赛、管工单，但不能碰系统设置 */
    ADMIN,
    /** 超级管理员：所有权限，包括系统设置、用户角色、备份恢复 */
    SUPER_ADMIN;

    public boolean atLeast(UserRole other) {
        return this.ordinal() >= other.ordinal();
    }

    public boolean isAdmin() {
        return this.atLeast(ADMIN);
    }
}

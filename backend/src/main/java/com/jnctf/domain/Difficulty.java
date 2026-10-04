package com.jnctf.domain;

/**
 * 难度只用来展示与筛选，真正影响分数的是 {@link ScoringType}。
 */
public enum Difficulty {
    BEGINNER("入门", "#22c55e"),
    EASY("简单", "#3b82f6"),
    MEDIUM("中等", "#a855f7"),
    HARD("困难", "#f97316"),
    INSANE("地狱", "#ef4444");

    private final String label;
    private final String color;

    Difficulty(String label, String color) {
        this.label = label;
        this.color = color;
    }

    public String getLabel() {
        return label;
    }

    public String getColor() {
        return color;
    }
}

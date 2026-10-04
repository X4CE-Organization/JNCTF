package com.jnctf.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * 统一响应体。前端只需要判断 {@code success}，错误信息在 {@code error} 里。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, T data, ApiError error, Instant timestamp) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, Instant.now());
    }

    public static ApiResponse<Void> ok() {
        return new ApiResponse<>(true, null, null, Instant.now());
    }

    public static <T> ApiResponse<T> fail(String code, String message) {
        return new ApiResponse<>(false, null, new ApiError(code, message, null), Instant.now());
    }

    public static <T> ApiResponse<T> fail(String code, String message, Object detail) {
        return new ApiResponse<>(false, null, new ApiError(code, message, detail), Instant.now());
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ApiError(String code, String message, Object detail) {
    }
}

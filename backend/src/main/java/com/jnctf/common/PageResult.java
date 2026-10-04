package com.jnctf.common;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * 分页结果。所有列表接口都返回这个形状，前端分页组件可以复用。
 */
public record PageResult<T>(List<T> items, long total, int page, int size, int totalPages) {

    public static <T> PageResult<T> of(Page<T> page) {
        return new PageResult<>(
                page.getContent(),
                page.getTotalElements(),
                page.getNumber() + 1,
                page.getSize(),
                page.getTotalPages());
    }

    public static <S, T> PageResult<T> of(Page<S> page, Function<S, T> mapper) {
        return new PageResult<>(
                page.getContent().stream().map(mapper).toList(),
                page.getTotalElements(),
                page.getNumber() + 1,
                page.getSize(),
                page.getTotalPages());
    }

    public static <T> PageResult<T> empty(int page, int size) {
        return new PageResult<>(List.of(), 0, page, size, 0);
    }
}

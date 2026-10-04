import type { GlobalThemeOverrides } from 'naive-ui';

const shared: GlobalThemeOverrides = {
  common: {
    primaryColor: '#5b5bf6',
    primaryColorHover: '#7a7aff',
    primaryColorPressed: '#4a4ae0',
    primaryColorSuppl: '#7a7aff',
    successColor: '#16a34a',
    warningColor: '#f59e0b',
    errorColor: '#e11d48',
    borderRadius: '12px',
    borderRadiusSmall: '9px',
    fontSize: '14px',
    fontWeightStrong: '700',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  Card: { borderRadius: '14px' },
  Button: { fontWeight: '600', borderRadiusMedium: '10px', borderRadiusSmall: '9px' },
  Input: { borderRadius: '10px' },
  DataTable: { thFontWeight: '600', borderRadius: '12px' },
  Tag: { borderRadius: '8px' },
  Menu: { itemBorderRadius: '10px' },
};

export const themeOverrides: GlobalThemeOverrides = {
  ...shared,
  Card: { borderRadius: '14px', color: '#ffffff', borderColor: 'rgba(15,23,42,0.08)' },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  ...shared,
  Card: { borderRadius: '14px', color: '#141a2c', borderColor: 'rgba(255,255,255,0.08)' },
};

/** 难度配色，全站统一：绿 → 蓝 → 紫 → 橙 → 红 */
export const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  BEGINNER: { label: '入门', color: '#22c55e' },
  EASY: { label: '简单', color: '#3b82f6' },
  MEDIUM: { label: '中等', color: '#a855f7' },
  HARD: { label: '困难', color: '#f97316' },
  INSANE: { label: '地狱', color: '#ef4444' },
};

export const SUBMISSION_META: Record<string, { label: string; type: 'success' | 'error' | 'warning' | 'info' }> = {
  CORRECT: { label: '正确', type: 'success' },
  WRONG: { label: '错误', type: 'error' },
  DUPLICATE: { label: '重复', type: 'warning' },
  RATE_LIMITED: { label: '超限', type: 'warning' },
  CLOSED: { label: '已关闭', type: 'info' },
};

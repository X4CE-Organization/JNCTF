import type { GlobalThemeOverrides } from 'naive-ui';

/** 主题：靛蓝主色、圆角稍大，和常见的后台模板区分开 */
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#6366f1',
    primaryColorHover: '#818cf8',
    primaryColorPressed: '#4f46e5',
    primaryColorSuppl: '#818cf8',
    borderRadius: '10px',
    borderRadiusSmall: '8px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  Card: { borderRadius: '14px' },
  Button: { fontWeight: '500' },
  DataTable: { thFontWeight: '600' },
};

/** 难度对应的颜色，全站统一 */
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

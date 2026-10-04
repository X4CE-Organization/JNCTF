import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * 终端风格配色。整体深色打底，主色用荧光青绿，次要色琥珀，
 * 直角、等宽字体——和「圆角渐变卡片」那一类站点刻意区分开。
 */
export const PALETTE = {
  bg: '#08090d',
  bgElev: '#0e1017',
  bgSoft: '#141821',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#e9ecf5',
  text2: '#a9b2c7',
  muted: '#6f7a93',
  accent: '#00e5a0',
  accentDim: 'rgba(0,229,160,0.12)',
  amber: '#ffb020',
  danger: '#ff4d6d',
  info: '#3ba0ff',
};

const base: GlobalThemeOverrides = {
  common: {
    primaryColor: PALETTE.accent,
    primaryColorHover: '#3dffbe',
    primaryColorPressed: '#00c78b',
    primaryColorSuppl: '#3dffbe',
    successColor: PALETTE.accent,
    warningColor: PALETTE.amber,
    errorColor: PALETTE.danger,
    infoColor: PALETTE.info,
    borderRadius: '6px',
    borderRadiusSmall: '5px',
    fontSize: '13px',
    fontWeightStrong: '700',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontFamilyMono: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, Consolas, monospace',
  },
  Button: { fontWeight: '600', borderRadiusMedium: '6px', borderRadiusSmall: '5px' },
  Card: {
    borderRadius: '8px',
    color: PALETTE.bgElev,
    borderColor: PALETTE.border,
    titleFontWeight: '700',
  },
  Input: {
    borderRadius: '6px',
    color: PALETTE.bgSoft,
    colorFocus: PALETTE.bgSoft,
    border: `1px solid ${PALETTE.border}`,
    borderFocus: `1px solid ${PALETTE.accent}`,
  },
  DataTable: { thFontWeight: '600', borderRadius: '8px' },
  Tag: { borderRadius: '4px' },
  Menu: { itemBorderRadius: '6px' },
};

/** 全站以深色为主 */
export const darkThemeOverrides: GlobalThemeOverrides = base;

export const themeOverrides: GlobalThemeOverrides = {
  ...base,
  Card: { ...base.Card, color: '#ffffff', borderColor: 'rgba(15,23,42,0.1)' },
};

/** 难度配色：绿 → 蓝 → 紫 → 橙 → 红 */
export const DIFFICULTY_META: Record<string, { label: string; short: string; color: string }> = {
  BEGINNER: { label: '入门', short: 'BG', color: '#00e5a0' },
  EASY: { label: '简单', short: 'EZ', color: '#3ba0ff' },
  MEDIUM: { label: '中等', short: 'MD', color: '#a06bff' },
  HARD: { label: '困难', short: 'HD', color: '#ffb020' },
  INSANE: { label: '地狱', short: 'IN', color: '#ff4d6d' },
};

export const SUBMISSION_META: Record<string, { label: string; type: 'success' | 'error' | 'warning' | 'info' }> = {
  CORRECT: { label: '正确', type: 'success' },
  WRONG: { label: '错误', type: 'error' },
  DUPLICATE: { label: '重复', type: 'warning' },
  RATE_LIMITED: { label: '超限', type: 'warning' },
  CLOSED: { label: '已关闭', type: 'info' },
};

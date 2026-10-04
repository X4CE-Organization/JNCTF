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

const common: GlobalThemeOverrides['common'] = {
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
};

const shared: GlobalThemeOverrides = {
  common,
  Button: { fontWeight: '600', borderRadiusMedium: '6px', borderRadiusSmall: '5px' },
  DataTable: { thFontWeight: '600', borderRadius: '8px' },
  Tag: { borderRadius: '4px' },
  Menu: { itemBorderRadius: '6px' },
  Popover: { borderRadius: '8px' },
  Dropdown: { borderRadius: '8px' },
  Tabs: { tabFontWeightActive: '700' },
};

/**
 * 浅色主题（默认）。输入框、下拉、表格底色都必须是浅色，
 * 否则会出现「白底页面上顶着黑输入框」这种割裂感。
 */
export const themeOverrides: GlobalThemeOverrides = {
  ...shared,
  common: { ...common, primaryColor: '#00a878', primaryColorPressed: '#008a63', primaryColorSuppl: '#00c78b' },
  Card: { color: '#ffffff', borderColor: 'rgba(11,15,25,0.1)', borderRadius: '8px' },
  Input: {
    color: '#f4f6fa',
    colorFocus: '#ffffff',
    border: '1px solid rgba(11,15,25,0.12)',
    borderHover: '1px solid rgba(11,15,25,0.24)',
    borderFocus: '1px solid #00a878',
    textColor: '#0b0f19',
    placeholderColor: '#7b8399',
    borderRadius: '6px',
  },
  InternalSelection: {
    color: '#f4f6fa',
    colorActive: '#f4f6fa',
    border: '1px solid rgba(11,15,25,0.12)',
    borderHover: '1px solid rgba(11,15,25,0.24)',
    borderActive: '1px solid #00a878',
    borderFocus: '1px solid #00a878',
    textColor: '#0b0f19',
    placeholderColor: '#7b8399',
    borderRadius: '6px',
  },
  InternalSelectMenu: { color: '#ffffff', optionTextColor: '#0b0f19', borderRadius: '6px' },
  InputNumber: { peers: { Input: { color: '#f4f6fa', textColor: '#0b0f19', borderRadius: '6px' } } },
  Switch: { railColor: 'rgba(11,15,25,0.18)', railColorActive: '#00a878' },
  Checkbox: { color: '#ffffff', border: '1px solid rgba(11,15,25,0.24)', checkMarkColor: '#04120c' },
  DataTable: { thColor: '#eceff6', thTextColor: '#454d63', tdColor: '#ffffff', tdColorHover: '#f4f6fa', borderColor: 'rgba(11,15,25,0.08)', thFontWeight: '600', borderRadius: '8px' },
  Modal: { color: '#ffffff' },
  Popover: { color: '#ffffff' },
  Dropdown: { color: '#ffffff', optionTextColor: '#0b0f19' },
};

/** 深色主题（可切换） */
export const darkThemeOverrides: GlobalThemeOverrides = {
  ...shared,
  Card: { color: PALETTE.bgElev, borderColor: PALETTE.border, borderRadius: '8px' },
  Input: {
    color: PALETTE.bgSoft,
    colorFocus: PALETTE.bgSoft,
    border: `1px solid ${PALETTE.border}`,
    borderHover: `1px solid ${PALETTE.borderStrong}`,
    borderFocus: `1px solid ${PALETTE.accent}`,
    textColor: PALETTE.text,
    placeholderColor: PALETTE.muted,
    borderRadius: '6px',
  },
  InternalSelection: {
    color: PALETTE.bgSoft,
    colorActive: PALETTE.bgSoft,
    border: `1px solid ${PALETTE.border}`,
    borderHover: `1px solid ${PALETTE.borderStrong}`,
    borderActive: `1px solid ${PALETTE.accent}`,
    textColor: PALETTE.text,
    placeholderColor: PALETTE.muted,
    borderRadius: '6px',
  },
  InternalSelectMenu: { color: PALETTE.bgElev, optionTextColor: PALETTE.text, borderRadius: '6px' },
  InputNumber: { peers: { Input: { color: PALETTE.bgSoft, textColor: PALETTE.text, borderRadius: '6px' } } },
  DataTable: { thColor: PALETTE.bgSoft, thTextColor: PALETTE.text2, tdColor: PALETTE.bgElev, tdColorHover: PALETTE.bgSoft, borderColor: PALETTE.border, thFontWeight: '600', borderRadius: '8px' },
  Modal: { color: PALETTE.bgElev },
  Popover: { color: PALETTE.bgElev },
  Dropdown: { color: PALETTE.bgElev, optionTextColor: PALETTE.text },
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

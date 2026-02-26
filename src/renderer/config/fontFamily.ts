export type FontFamilyKey = 'system' | 'sf-pro' | 'pingfang' | 'hiragino' | 'songti' | 'helvetica';

export const DEFAULT_FONT_FAMILY: FontFamilyKey = 'system';

export interface FontRoleStacks {
  display: string;
  body: string;
  mono: string;
}

const MONO_STACK = "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace";

export const FONT_FAMILY_ROLE_STACKS: Record<FontFamilyKey, FontRoleStacks> = {
  system: {
    display:
      "'SF Pro Display', 'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif",
    body:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'PingFang SC', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    mono: MONO_STACK,
  },
  'sf-pro': {
    display:
      "'SF Pro Display', 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif",
    body:
      "'SF Pro Text', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    mono: MONO_STACK,
  },
  pingfang: {
    display: "'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif",
    body:
      "'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
    mono: MONO_STACK,
  },
  hiragino: {
    display: "'Hiragino Sans GB', 'PingFang SC', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif",
    body:
      "'Hiragino Sans GB', 'PingFang SC', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
    mono: MONO_STACK,
  },
  songti: {
    display: "'Songti SC', 'STSong', 'Times New Roman', serif",
    body: "'Songti SC', 'STSong', 'Times New Roman', serif",
    mono: MONO_STACK,
  },
  helvetica: {
    display: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    body: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    mono: MONO_STACK,
  },
};

export const FONT_FAMILY_OPTIONS: Array<{ value: FontFamilyKey; label: string }> = [
  { value: 'system', label: '系统默认（推荐）' },
  { value: 'sf-pro', label: 'SF Pro' },
  { value: 'pingfang', label: 'PingFang SC（苹方）' },
  { value: 'hiragino', label: 'Hiragino Sans GB（冬青黑体）' },
  { value: 'songti', label: 'Songti SC（宋体）' },
  { value: 'helvetica', label: 'Helvetica Neue' },
];

export const normalizeFontFamily = (value: string | null | undefined): FontFamilyKey => {
  if (value && Object.prototype.hasOwnProperty.call(FONT_FAMILY_ROLE_STACKS, value)) {
    return value as FontFamilyKey;
  }
  return DEFAULT_FONT_FAMILY;
};

export const resolveFontFamilyRoles = (value: string | null | undefined): FontRoleStacks => {
  const key = normalizeFontFamily(value);
  return FONT_FAMILY_ROLE_STACKS[key];
};

// Backward-compatible helper for existing call-sites.
export const resolveFontFamilyStack = (value: string | null | undefined): string => {
  return resolveFontFamilyRoles(value).body;
};

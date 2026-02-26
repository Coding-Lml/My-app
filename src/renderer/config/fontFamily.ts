export type FontFamilyKey = 'system' | 'sf-pro' | 'pingfang' | 'hiragino' | 'songti' | 'helvetica';

export const DEFAULT_FONT_FAMILY: FontFamilyKey = 'system';

export const FONT_FAMILY_STACKS: Record<FontFamilyKey, string> = {
  system:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'PingFang SC', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  'sf-pro':
    "'SF Pro Text', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  pingfang:
    "'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
  hiragino:
    "'Hiragino Sans GB', 'PingFang SC', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
  songti: "'Songti SC', 'STSong', 'Times New Roman', serif",
  helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
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
  if (value && Object.prototype.hasOwnProperty.call(FONT_FAMILY_STACKS, value)) {
    return value as FontFamilyKey;
  }
  return DEFAULT_FONT_FAMILY;
};

export const resolveFontFamilyStack = (value: string | null | undefined): string => {
  const key = normalizeFontFamily(value);
  return FONT_FAMILY_STACKS[key];
};

export const NATIVE_LANGUAGES = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  zh: '中文',
  ja: '日本語',
} as const;
export type NativeLanguage = keyof typeof NATIVE_LANGUAGES;
export type PracticeMode = 'daily' | 'diagnostic' | 'fluency';

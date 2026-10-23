export const NATIVE_LANGUAGES = {
  es: 'Español',
  en: 'English',
} as const;
export type NativeLanguage = keyof typeof NATIVE_LANGUAGES;
export type PracticeMode = 'daily' | 'diagnostic' | 'fluency';

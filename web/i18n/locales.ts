export const APP_LOCALES = ['es', 'en'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'es';
export const TARGET_LANGUAGE = 'en' as const;

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'es' || value === 'en';
}

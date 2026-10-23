import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isAppLocale } from '@/i18n/locales';
import { currentPreferences } from '@/lib/preferences';
import { currentLearnerId } from '@/lib/session';

export default getRequestConfig(async () => {
  const learner = await currentLearnerId();
  const savedCookie = (await cookies()).get('app_locale')?.value;
  const locale = learner
    ? (await currentPreferences()).nativeLanguage
    : isAppLocale(savedCookie)
      ? savedCookie
      : DEFAULT_LOCALE;
  return {
    locale,
    timeZone: 'America/Bogota',
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

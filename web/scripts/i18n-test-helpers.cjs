const { createTranslator } = require('next-intl');
const ids = require('../i18n/static-message-ids.json');
function intl(locale = 'es') {
  const messages = require(`../messages/${locale}.json`);
  return {
    useLocale: () => locale,
    useTranslations: (namespace) =>
      createTranslator({
        locale,
        messages,
        namespace,
        onError: (error) => {
          throw error;
        },
      }),
  };
}
function dependency(name, locale = 'es') {
  const mock = intl(locale);
  if (name === '@/hooks/use-timer-alarm')
    return { useTimerAlarm: () => ({ ready: true, enable: async () => {} }) };
  if (name === 'next-intl') return mock;
  if (name === 'next-intl/server')
    return {
      getLocale: async () => locale,
      getTranslations: async (namespace) => mock.useTranslations(namespace),
    };
  if (name === '@/i18n/static-text')
    return { translateStatic: (t, source) => (ids[source] ? t(ids[source]) : source) };
  if (name === '@/lib/preferences')
    return { currentPreferences: async () => ({ nativeLanguage: locale, targetLanguage: 'en' }) };
}
module.exports = { intl, dependency };

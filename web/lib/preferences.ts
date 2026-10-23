import { cache } from 'react';
import { type AppLocale, DEFAULT_LOCALE, TARGET_LANGUAGE, isAppLocale } from '@/i18n/locales';
import { type Sql, getDb } from '@/lib/db';
import { currentLearnerId } from '@/lib/session';

export type Preferences = { nativeLanguage: AppLocale; targetLanguage: typeof TARGET_LANGUAGE };
export const DEFAULT_PREFERENCES: Preferences = {
  nativeLanguage: DEFAULT_LOCALE,
  targetLanguage: TARGET_LANGUAGE,
};

export async function readPreferences(sql: Sql, learnerId: string): Promise<Preferences> {
  const rows = await sql<{ native_language: string }>`
    SELECT native_language FROM learner_preferences WHERE learner_id = ${learnerId}`;
  return {
    nativeLanguage: isAppLocale(rows[0]?.native_language)
      ? rows[0].native_language
      : DEFAULT_LOCALE,
    targetLanguage: TARGET_LANGUAGE,
  };
}

// Shared by the layout, page and token/review endpoints. Never cache across users.
export const currentPreferences = cache(async (): Promise<Preferences> => {
  const learnerId = await currentLearnerId();
  const sql = getDb();
  if (!learnerId || !sql) return DEFAULT_PREFERENCES;
  try {
    return await readPreferences(sql, learnerId);
  } catch {
    // Old installations remain usable until the additive migration is applied.
    // Writes deliberately fail rather than claiming an unsaved preference.
    console.warn('profile.preferences.unavailable');
    return DEFAULT_PREFERENCES;
  }
});

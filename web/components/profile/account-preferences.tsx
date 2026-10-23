'use client';

import { useEffect, useState } from 'react';
import { ProfileSettings, type ProfileSettingsLabels } from '@/components/profile/profile-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { isAppLocale } from '@/i18n/locales';
import type { Preferences } from '@/lib/preferences';

export type AccountPreferencesLabels = {
  menu: string;
  description: string;
  loading: string;
  loadFailed: string;
  retry: string;
  form: ProfileSettingsLabels;
};

/** Mounted by Clerk's custom profile page, not while the avatar menu is closed. */
export function AccountPreferences({ labels }: { labels: AccountPreferencesLabels }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    setPreferences(null);
    async function load() {
      try {
        const response = await fetch('/api/profile', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('preferences_unavailable');
        const data = await response.json();
        if (!isAppLocale(data.nativeLanguage) || data.targetLanguage !== 'en')
          throw new Error('invalid_preferences');
        if (!controller.signal.aborted)
          setPreferences({ nativeLanguage: data.nativeLanguage, targetLanguage: 'en' });
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  return (
    <section className="w-full max-w-2xl">
      <h2 className="text-foreground text-xl font-semibold">{labels.menu}</h2>
      <p className="text-muted-foreground mt-2 mb-6 text-sm leading-6">{labels.description}</p>
      {preferences ? (
        <ProfileSettings initial={preferences} labels={labels.form} embedded />
      ) : failed ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm">
            {labels.loadFailed}
          </p>
          <button className="study-text-link" onClick={() => setAttempt((value) => value + 1)}>
            {labels.retry}
          </button>
        </div>
      ) : (
        <div role="status" aria-busy="true">
          <span className="sr-only">{labels.loading}</span>
          <div aria-hidden="true" className="space-y-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-44" />
          </div>
        </div>
      )}
    </section>
  );
}

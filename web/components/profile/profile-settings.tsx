'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { APP_LOCALES, type AppLocale } from '@/i18n/locales';
import type { Preferences } from '@/lib/preferences';

export type ProfileSettingsLabels = {
  native: string;
  target: string;
  english: string;
  fixed: string;
  practice: string;
  save: string;
  saving: string;
  saved: string;
  failed: string;
  migration: string;
};

// The server translates this small, static form. Client state needs no intl
// context, including during route transitions and the router.refresh after save.
export function ProfileSettings({
  initial,
  labels,
  embedded = false,
}: {
  initial: Preferences;
  labels: ProfileSettingsLabels;
  embedded?: boolean;
}) {
  const targetId = useId();
  const router = useRouter();
  const [nativeLanguage, setNativeLanguage] = useState(initial.nativeLanguage);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'failed' | 'migration' | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nativeLanguage, targetLanguage: 'en' }),
      });
      if (!result.ok) {
        setNotice(result.status === 503 ? 'migration' : 'failed');
        return;
      }
      setNotice('saved');
      router.refresh();
    } catch {
      setNotice('failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className={
        embedded ? 'space-y-6' : 'bg-card max-w-2xl space-y-6 rounded-2xl border p-6 md:p-8'
      }
      aria-busy={busy}
    >
      <label className="block text-sm font-medium">
        {labels.native}
        <select
          className="study-field"
          value={nativeLanguage}
          disabled={busy}
          onChange={(event) => {
            setNativeLanguage(event.target.value as AppLocale);
            setNotice(null);
          }}
        >
          {APP_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {locale === 'es' ? 'Español' : 'English'}
            </option>
          ))}
        </select>
      </label>
      <div>
        <p className="text-sm font-medium" id={`${targetId}-label`}>
          {labels.target}
        </p>
        <p
          className="study-field text-muted-foreground"
          aria-labelledby={`${targetId}-label`}
          aria-describedby={`${targetId}-note`}
        >
          {labels.english}
        </p>
        <p id={`${targetId}-note`} className="text-muted-foreground mt-2 text-sm leading-6">
          {labels.fixed}
        </p>
      </div>
      <p className="text-muted-foreground text-sm leading-6">{labels.practice}</p>
      <button className="study-button" type="submit" disabled={busy}>
        {busy ? labels.saving : labels.save}
      </button>
      {notice && (
        <p role={notice === 'saved' ? 'status' : 'alert'} className="text-sm">
          {labels[notice]}
        </p>
      )}
    </form>
  );
}

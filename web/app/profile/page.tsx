import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { ProfileSettings } from '@/components/profile/profile-settings';
import { getDb } from '@/lib/db';
import { requireLearnerId } from '@/lib/guard';
import { getLearner } from '@/lib/learners';
import { currentPreferences } from '@/lib/preferences';

export const dynamic = 'force-dynamic';
export default async function ProfilePage() {
  const learnerId = await requireLearnerId();
  const sql = getDb();
  const learner = sql ? await getLearner(sql, learnerId) : null;
  if (!learner) redirect('/login');
  const [t, preferences] = await Promise.all([getTranslations('profile'), currentPreferences()]);
  return (
    <AppShell learner={learner} active="profile">
      <header className="mb-8 max-w-2xl">
        <h1 className="study-title">{t('title')}</h1>
        <p className="text-muted-foreground mt-4 leading-7">{t('description')}</p>
      </header>
      <section className="mb-6 max-w-2xl border-l-2 pl-4">
        <p className="text-muted-foreground text-xs">{t('name')}</p>
        <p className="mt-1 font-semibold">{learner.displayName}</p>
        <p className="text-muted-foreground mt-2 text-sm">{t('account')}</p>
      </section>
      <ProfileSettings
        initial={preferences}
        labels={{
          native: t('native'),
          target: t('target'),
          english: t('english'),
          fixed: t('fixed'),
          practice: t('practice'),
          save: t('save'),
          saving: t('saving'),
          saved: t('saved'),
          failed: t('failed'),
          migration: t('migration'),
        }}
      />
    </AppShell>
  );
}

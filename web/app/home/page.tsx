import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PracticeHome } from '@/components/home/practice-home';
import { PracticeOverview } from '@/components/home/practice-overview';
import { OverviewSkeleton } from '@/components/layout/page-skeletons';
import { getDb } from '@/lib/db';
import { requireLearnerId } from '@/lib/guard';
import { getLearner } from '@/lib/learners';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const t = await getTranslations('ui');

  const learnerId = await requireLearnerId();
  const sql = getDb();
  if (!sql)
    return (
      <main className="study-empty">
        <h1 className="study-title">{t('mb4d548950279')}</h1>
        <p>{t('m6e693f4dbfa6')}</p>
        <Link className="study-button" href="/call">
          {t('m8f0565846c94')}
        </Link>
      </main>
    );
  const learner = await getLearner(sql, learnerId);
  if (!learner) redirect('/login');
  return (
    <PracticeHome
      learner={learner}
      overview={
        <Suspense fallback={<OverviewSkeleton />}>
          <PracticeOverview sql={sql} learnerId={learnerId} />
        </Suspense>
      }
    />
  );
}

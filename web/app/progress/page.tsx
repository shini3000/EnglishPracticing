import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import {
  ChartsSkeleton,
  HistorySkeleton,
  LearningSkeleton,
} from '@/components/layout/page-skeletons';
import { ActivityHistory } from '@/components/progress/activity-history';
import { LearningSection, StatisticsSection } from '@/components/progress/progress-sections';
import { Button } from '@/components/ui/button';
import { getDb } from '@/lib/db';
import { requireLearnerId } from '@/lib/guard';
import { getLearner } from '@/lib/learners';

/**
 * /progress — the learner's dashboard.
 *
 * Server-rendered by calling the same analysis code /api/progress uses, rather than fetching
 * its own API over HTTP. A server component fetching its own route would mean an extra network
 * hop, cookie forwarding, and a second failure mode for no gain. The API route exists for
 * clients that want JSON; this page shares the logic beneath it.
 *
 * The old "no profile yet" gate is gone, and could not fire if it were still here: you cannot
 * reach this page without a session, and a session names a learner. Sign-in creates the row.
 */

export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const learnerId = await requireLearnerId();

  const sql = getDb();
  if (!sql) {
    // No DATABASE_URL. The tutor still works — progress tracking is the optional half — so say
    // exactly that rather than showing a broken chart or a 500.
    return (
      <main className="bg-background grid min-h-svh place-content-center px-6">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-foreground text-xl font-semibold">
            Progress tracking isn&apos;t set up
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            This server has no database configured, so sessions aren&apos;t being recorded. The
            tutor itself works fine.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link href="/call">Talk to Ahmad</Link>
          </Button>
        </div>
      </main>
    );
  }

  const learner = await getLearner(sql, learnerId);
  if (!learner) {
    redirect('/login');
  }

  return (
    <AppShell learner={learner} active="progress">
      <header className="mb-10 max-w-2xl">
        <h1 className="study-title">Lo que estás construyendo.</h1>
        <p className="text-muted-foreground mt-4 leading-7">
          Tu constancia, el vocabulario que vuelves a usar y las estructuras que necesitan otro
          intento. Una sola respuesta no equivale a aprendizaje consolidado.
        </p>
      </header>
      <Suspense fallback={<LearningSkeleton />}>
        <LearningSection sql={sql} learnerId={learnerId} />
      </Suspense>
      <Suspense fallback={<HistorySkeleton />}>
        <ActivityHistory sql={sql} learnerId={learnerId} />
      </Suspense>
      <Suspense fallback={<ChartsSkeleton />}>
        <StatisticsSection sql={sql} learnerId={learnerId} />
      </Suspense>
    </AppShell>
  );
}

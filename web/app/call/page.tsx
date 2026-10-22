import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { App } from '@/components/app/app';
import { getDb } from '@/lib/db';
import { requireLearnerId } from '@/lib/guard';
import { getLearner } from '@/lib/learners';
import { getAppConfig } from '@/lib/utils';

/**
 * /call — the voice session itself.
 *
 * Clerk session and learner checks run before showing the preparation screen.
 * /api/token independently re-checks the session before minting a room token.
 * loading.tsx provides feedback while these server checks and configuration load.
 *
 * The learner's name is looked up purely so the pre-call screen can greet them. A failed lookup
 * is not fatal — a missing name costs a nicety, and taking the tutor down over it would be
 * absurd.
 */

export const dynamic = 'force-dynamic';

export default async function CallPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const { start } = await searchParams;
  const learnerId = await requireLearnerId();
  if (start === 'input') redirect('/practice-b/input');
  if (start === 'agility') redirect('/practice-b/agility');
  const startStep =
    ({ anchors: 4, agility: 9, audit: 15 } as Record<string, number>)[start ?? ''] ?? 0;
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  const sql = getDb();
  const learner = sql ? await getLearner(sql, learnerId) : null;

  return (
    <App
      key={startStep}
      startStep={startStep}
      appConfig={appConfig}
      learnerName={learner?.displayName ?? null}
    />
  );
}

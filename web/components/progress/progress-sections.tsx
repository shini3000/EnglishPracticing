import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/progress/dashboard';
import { LearningDashboard } from '@/components/progress/learning-dashboard';
import type { Sql } from '@/lib/db';
import { buildLearningSummary } from '@/lib/progress/learning';
import { buildSummary } from '@/lib/progress/summary';

type Props = { sql: Sql; learnerId: string };

export async function LearningSection({ sql, learnerId }: Props) {
  return <LearningDashboard initial={await buildLearningSummary(sql, learnerId)} />;
}

export async function StatisticsSection({ sql, learnerId }: Props) {
  const summary = await buildSummary(sql, learnerId);
  if (!summary) redirect('/login');
  return <Dashboard summary={summary} />;
}

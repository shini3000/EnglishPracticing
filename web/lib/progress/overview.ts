import type { Sql } from '@/lib/db';
import { currentStreakDays, estimateLevel } from './analysis';
import type { LevelEstimate, SessionRow } from './types';

export type PracticeOverview = {
  sessions: number;
  practiceMinutes: number;
  currentStreakDays: number;
  level: LevelEstimate;
};

type OverviewRow = Pick<SessionRow, 'duration_seconds' | 'cefr_estimate' | 'cefr_confidence'> & {
  started_at: string | Date;
};

/** Same 200-session window and scoring rules as progress, without loading its analysis. */
export async function buildPracticeOverview(
  sql: Sql,
  learnerId: string
): Promise<PracticeOverview> {
  const rows = await sql<OverviewRow>`
    SELECT started_at, duration_seconds, cefr_estimate, cefr_confidence
    FROM sessions WHERE learner_id = ${learnerId}
    ORDER BY started_at DESC LIMIT 200
  `;
  const sessions = rows.map((row) => ({
    ...row,
    started_at: row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at,
  }));
  return {
    sessions: sessions.length,
    practiceMinutes: Math.round(sessions.reduce((sum, row) => sum + row.duration_seconds, 0) / 60),
    currentStreakDays: currentStreakDays(sessions),
    level: estimateLevel(sessions),
  };
}

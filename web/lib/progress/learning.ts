import type { Sql } from '@/lib/db';

export type LearningAttempt = {
  date: string;
  result: 'unaided' | 'helped' | 'failed';
  attempt_type: string;
  observed: boolean;
  context: string;
  evidence: string;
};
export type LearningItem = {
  item_type: 'vocabulary' | 'structure';
  key: string;
  label: string;
  state: 'EN PRÁCTICA' | 'EN CONSOLIDACIÓN' | 'CONSOLIDADA' | 'REPASO PENDIENTE';
  introduced_on: string;
  successful_days: string[];
  context_count: number;
  span_days: number;
  attempt_count: number;
  assessed_attempts: number;
  unaided_successes: number;
  helped_attempts: number;
  failed_attempts: number;
  last_result: string | null;
  next_review: string | null;
  due: boolean;
  attempts: LearningAttempt[];
  policy: {
    min_days: number;
    min_span_days: number;
    min_contexts: number;
    maintenance_days: number;
  };
};
export type LearningSummary = {
  available: boolean;
  items: LearningItem[];
  totals: {
    introduced: number;
    consolidating: number;
    consolidated: number;
    vocabulary: number;
    structures: number;
    due: number;
    attempts: number;
    unaided: number;
    helped: number;
    failed: number;
    successRate: number | null;
    practiceDays: number;
    measuredMinutes: number;
  };
  trend: { date: string; unaided: number; helped: number; failed: number }[];
};

const blankTotals = {
  introduced: 0,
  consolidating: 0,
  consolidated: 0,
  vocabulary: 0,
  structures: 0,
  due: 0,
  attempts: 0,
  unaided: 0,
  helped: 0,
  failed: 0,
  successRate: null,
  practiceDays: 0,
  measuredMinutes: 0,
};

export async function buildLearningSummary(sql: Sql, learnerId: string): Promise<LearningSummary> {
  try {
    const rows = await sql<{ snapshot: LearningItem }>`
      SELECT snapshot FROM learner_learning_items WHERE learner_id = ${learnerId}
      ORDER BY item_type, item_key
    `;
    const sessions = await sql<{
      room_name: string;
      entry: {
        timer?: {
          completed?: { elapsed_seconds: number }[];
          step_index?: number;
          elapsed_seconds?: number;
        };
      };
    }>`
      SELECT DISTINCT ON (room_name) room_name, entry FROM practice_journal
      WHERE learner_id = ${learnerId} AND entry->>'kind' = 'session'
      ORDER BY room_name, created_at DESC
    `;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const items = rows.map(({ snapshot }) => ({
      ...snapshot,
      state:
        snapshot.state === 'CONSOLIDADA' &&
        snapshot.successful_days.length &&
        (Date.parse(today) -
          Date.parse(snapshot.successful_days[snapshot.successful_days.length - 1])) /
          86400000 >
          snapshot.policy.maintenance_days
          ? ('REPASO PENDIENTE' as const)
          : snapshot.state,
      due: snapshot.next_review !== null && snapshot.next_review <= today,
    }));
    const attempts = items
      .flatMap((item) => item.attempts)
      .filter((a) => a.observed && ['review', 'transfer'].includes(a.attempt_type) && a.context);
    const days = new Map<
      string,
      { date: string; unaided: number; helped: number; failed: number }
    >();
    for (const attempt of attempts) {
      const point = days.get(attempt.date) ?? {
        date: attempt.date,
        unaided: 0,
        helped: 0,
        failed: 0,
      };
      if (['unaided', 'helped', 'failed'].includes(attempt.result)) point[attempt.result]++;
      days.set(attempt.date, point);
    }
    const unaided = attempts.filter((a) => a.result === 'unaided').length;
    const measuredSeconds = sessions.reduce((sum, session) => {
      const timer = session.entry.timer;
      const completed = timer?.completed ?? [];
      const partial =
        (timer?.step_index ?? 0) >= completed.length ? (timer?.elapsed_seconds ?? 0) : 0;
      return sum + completed.reduce((s, step) => s + (step.elapsed_seconds || 0), 0) + partial;
    }, 0);
    return {
      available: true,
      items,
      totals: {
        introduced: items.length,
        consolidating: items.filter((i) => i.state === 'EN CONSOLIDACIÓN').length,
        consolidated: items.filter((i) => i.state === 'CONSOLIDADA').length,
        vocabulary: items.filter((i) => i.item_type === 'vocabulary').length,
        structures: items.filter((i) => i.item_type === 'structure').length,
        due: items.filter((i) => i.due).length,
        attempts: attempts.length,
        unaided,
        helped: attempts.filter((a) => a.result === 'helped').length,
        failed: attempts.filter((a) => a.result === 'failed').length,
        successRate: attempts.length ? Math.round((100 * unaided) / attempts.length) : null,
        practiceDays: days.size,
        measuredMinutes: Math.round(measuredSeconds / 60),
      },
      trend: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch {
    return { available: false, items: [], totals: blankTotals, trend: [] };
  }
}

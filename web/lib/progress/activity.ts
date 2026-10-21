import type { Sql } from '@/lib/db';
import { practiceDay } from './dates';

export type Activity = {
  id: string;
  at: string;
  type: 'call' | 'drill';
  label: string;
  text?: string;
  feedback?: string;
  corrections?: { original: string; corrected: string; explanation: string }[];
};

export function groupActivity(items: Activity[]) {
  const days = new Map<string, Activity[]>();
  for (const item of [...items].sort((a, b) => b.at.localeCompare(a.at))) {
    const day = practiceDay(item.at);
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, activities]) => ({ day, activities }));
}

export async function getActivity(sql: Sql, learnerId: string): Promise<Activity[]> {
  const callsPromise = sql<{ id: string; started_at: string | Date }>`
    SELECT id, started_at FROM sessions WHERE learner_id = ${learnerId}
    ORDER BY started_at DESC LIMIT 200`;
  const drillsPromise = sql<{
    id: string;
    created_at: string | Date;
    entry: {
      step?: number;
      text?: string;
      feedback?: string;
      corrections?: Activity['corrections'];
    };
  }>`SELECT id, created_at, entry FROM practice_journal WHERE learner_id = ${learnerId}
      AND entry->>'kind' = 'drill_review' ORDER BY created_at DESC LIMIT 200`;
  const [calls, drills] = await Promise.all([callsPromise, drillsPromise]);
  const iso = (value: string | Date) => new Date(value).toISOString();
  return [
    ...calls.map((c) => ({
      id: c.id,
      at: iso(c.started_at),
      type: 'call' as const,
      label: 'Llamada de práctica',
    })),
    ...drills.map((d) => ({
      id: d.id,
      at: iso(d.created_at),
      type: 'drill' as const,
      label: `Práctica B · Gimnasia temporal · paso ${(d.entry.step ?? 0) + 1}`,
      text: d.entry.text,
      feedback: d.entry.feedback,
      corrections: d.entry.corrections,
    })),
  ];
}

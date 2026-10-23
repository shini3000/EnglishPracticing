import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentLearnerId } from '@/lib/session';

export const revalidate = 0;
const privateResponse = { headers: { 'Cache-Control': 'private, no-store' } };

export async function GET(request: Request) {
  const learnerId = await currentLearnerId();
  if (!learnerId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const day = new URL(request.url).searchParams.get('day');
  if (
    day !== null &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      Number.isNaN(Date.parse(day + 'T00:00:00Z')) ||
      new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day)
  )
    return NextResponse.json({ error: 'Invalid day' }, { status: 400, ...privateResponse });
  const sql = getDb();
  if (!sql) return NextResponse.json({ available: false, entries: [] }, privateResponse);
  try {
    if (day !== null) {
      const [rows, days] = await Promise.all([
        sql<{ entry: unknown }>`SELECT entry FROM practice_journal WHERE learner_id = ${learnerId}
          AND entry->>'kind' IN ('correction', 'drill_review')
          AND created_at >= (${day}::date::timestamp AT TIME ZONE 'America/Bogota')
          AND created_at < ((${day}::date + 1)::timestamp AT TIME ZONE 'America/Bogota')
          ORDER BY created_at DESC`,
        sql<{
          day: string;
        }>`SELECT DISTINCT to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS day
          FROM practice_journal WHERE learner_id = ${learnerId}
          AND entry->>'kind' IN ('correction', 'drill_review') ORDER BY day DESC`,
      ]);
      return NextResponse.json(
        {
          available: true,
          day,
          days: days.map((row) => row.day),
          hasMore: false,
          entries: rows.map((row) => row.entry),
        },
        privateResponse
      );
    }
    const rows = await sql<{ entry: unknown }>`
      SELECT entry FROM practice_journal WHERE learner_id = ${learnerId}
      AND entry->>'kind' IN ('correction', 'drill_review')
      ORDER BY created_at DESC LIMIT 201
    `;
    return NextResponse.json(
      {
        available: true,
        hasMore: rows.length > 200,
        entries: rows
          .slice(0, 200)
          .reverse()
          .map((r) => r.entry),
      },
      privateResponse
    );
  } catch {
    return NextResponse.json({ available: false, entries: [] }, privateResponse);
  }
}

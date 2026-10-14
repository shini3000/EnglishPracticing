import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentLearnerId } from '@/lib/session';

export const revalidate = 0;

export async function GET() {
  const learnerId = await currentLearnerId();
  if (!learnerId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const sql = getDb();
  if (!sql) return NextResponse.json({ available: false, entries: [] });
  try {
    const rows = await sql<{ entry: unknown }>`
      SELECT entry FROM practice_journal WHERE learner_id = ${learnerId}
      ORDER BY created_at DESC LIMIT 200
    `;
    return NextResponse.json({ available: true, entries: rows.reverse().map((r) => r.entry) });
  } catch {
    return NextResponse.json({ available: false, entries: [] });
  }
}

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { buildLearningSummary } from '@/lib/progress/learning';
import { currentLearnerId } from '@/lib/session';

export const revalidate = 0;
export async function GET() {
  const learnerId = await currentLearnerId();
  if (!learnerId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const sql = getDb();
  if (!sql)
    return NextResponse.json(
      { available: false },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  return NextResponse.json(await buildLearningSummary(sql, learnerId), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

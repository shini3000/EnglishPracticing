import { getTranslations } from 'next-intl/server';
import { NextResponse } from 'next/server';
import { translateStatic } from '@/i18n/static-text';
import { getDb } from '@/lib/db';
import { getActivity } from '@/lib/progress/activity';
import { SESSION_FILTERS } from '@/lib/progress/filters';
import { buildLearningSummary } from '@/lib/progress/learning';
import { mobileStatistics } from '@/lib/progress/mobile';
import { buildSummary } from '@/lib/progress/summary';
import type { DisplayMessage } from '@/lib/progress/types';
import { currentLearnerId } from '@/lib/session';

export const revalidate = 0;
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  const learner = await currentLearnerId();
  if (!learner) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
  const search = new URL(request.url).searchParams;
  const window = search.get('window') || 'all';
  if (
    [...search.keys()].some((key) => key !== 'window') ||
    !SESSION_FILTERS.some((item) => item.key === window)
  )
    return NextResponse.json({ error: 'invalid_window' }, { status: 400, headers });
  const sql = getDb();
  if (!sql) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers });
  try {
    const t = await getTranslations({ locale: 'es', namespace: 'ui' });
    const text = (source: string) => translateStatic(t, source);
    const message = (value: DisplayMessage | undefined, fallback: string) =>
      value ? t(value.key, value.values) : text(fallback);
    // Same queries and pure calculations as the web; no provider or model calls.
    const [summary, learning, activity] = await Promise.all([
      buildSummary(sql, learner),
      buildLearningSummary(sql, learner),
      getActivity(sql, learner)
        .then((items) => ({
          available: true,
          items: items.sort((a, b) => b.at.localeCompare(a.at)),
        }))
        .catch(() => ({ available: false, items: [] })),
    ]);
    if (!summary) return NextResponse.json({ error: 'no_profile' }, { status: 404, headers });
    return NextResponse.json(
      { statistics: mobileStatistics(summary, window, text, message), learning, activity },
      { headers }
    );
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers });
  }
}

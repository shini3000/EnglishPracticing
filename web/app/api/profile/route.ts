import { NextResponse } from 'next/server';
import { TARGET_LANGUAGE, isAppLocale } from '@/i18n/locales';
import { getDb } from '@/lib/db';
import { readPreferences } from '@/lib/preferences';
import { currentLearnerId } from '@/lib/session';

const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  const learnerId = await currentLearnerId();
  if (!learnerId) return NextResponse.json({ code: 'unauthorized' }, { status: 401, headers });
  const sql = getDb();
  if (!sql) return NextResponse.json({ code: 'unavailable' }, { status: 503, headers });
  try {
    return NextResponse.json(await readPreferences(sql, learnerId), { headers });
  } catch {
    return NextResponse.json({ code: 'unavailable' }, { status: 503, headers });
  }
}

export async function PATCH(request: Request) {
  const learnerId = await currentLearnerId();
  if (!learnerId) return NextResponse.json({ code: 'unauthorized' }, { status: 401, headers });
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return NextResponse.json({ code: 'origin' }, { status: 403, headers });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid' }, { status: 400, headers });
  }
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !['nativeLanguage', 'targetLanguage'].includes(key)) ||
    !isAppLocale(body.nativeLanguage) ||
    (body.targetLanguage !== undefined && body.targetLanguage !== TARGET_LANGUAGE)
  )
    return NextResponse.json({ code: 'invalid' }, { status: 400, headers });
  const sql = getDb();
  if (!sql) return NextResponse.json({ code: 'unavailable' }, { status: 503, headers });
  try {
    await sql`INSERT INTO learner_preferences(learner_id, native_language, target_language)
      VALUES (${learnerId}, ${body.nativeLanguage}, ${TARGET_LANGUAGE})
      ON CONFLICT (learner_id) DO UPDATE SET native_language = EXCLUDED.native_language, updated_at = now()`;
    const response = NextResponse.json(
      { nativeLanguage: body.nativeLanguage, targetLanguage: TARGET_LANGUAGE },
      { headers }
    );
    // Only a display-language hint for signed-out screens. Authenticated requests
    // always read their own durable profile, not a previous user's browser cookie.
    response.cookies.set('app_locale', body.nativeLanguage, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 31536000,
    });
    return response;
  } catch {
    return NextResponse.json({ code: 'unavailable' }, { status: 503, headers });
  }
}

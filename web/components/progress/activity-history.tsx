import { getLocale, getTranslations } from 'next-intl/server';
import type { Sql } from '@/lib/db';
import { getActivity, groupActivity } from '@/lib/progress/activity';
import { formatPracticeDateTime } from '@/lib/progress/dates';

export async function ActivityHistory({ sql, learnerId }: { sql: Sql; learnerId: string }) {
  const t = await getTranslations('ui');
  const locale = await getLocale();

  let activities;
  try {
    activities = await getActivity(sql, learnerId);
  } catch {
    return <p className="my-6 rounded border p-4">{t('m6c19de4f95de')}</p>;
  }
  const days = groupActivity(activities);
  return (
    <section className="my-8 space-y-4">
      <h2 className="text-xl font-semibold">{t('mb1a677d4fb79')}</h2>
      <p>
        {days.length} {t('m08a5ac1876ed')} {activities.filter((a) => a.type === 'call').length}{' '}
        {t('md342593ecb02')} {activities.filter((a) => a.type === 'drill').length}{' '}
        {t('mfab35d0fd9ce')}
      </p>
      <p className="text-muted-foreground text-sm">{t('m38ebee490060')}</p>
      {!days.length && <p>{t('mbd94f025b304')}</p>}
      {days.map(({ day, activities: entries }) => (
        <details key={day} className="rounded border p-4" open={day === days[0].day}>
          <summary>
            {day} · {entries.length} {t('m1097084a95bc')}
          </summary>
          {entries.map((entry) => (
            <article key={entry.id} className="my-3 border-t pt-3">
              <p>
                {formatPracticeDateTime(entry.at, locale)} ·{' '}
                {entry.type === 'call'
                  ? t('practiceCall')
                  : t(entry.block === 4 ? 'agilityActivity' : 'temporalActivity', {
                      step: (entry.step ?? 0) + 1,
                    })}
              </p>
              {entry.text && (
                <details>
                  <summary>{t('m67f03328ccf5')}</summary>
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                  <p>{entry.feedback}</p>
                  {entry.corrections?.map((c, i) => (
                    <div key={i} className="mt-2">
                      <p>
                        {t('m1df012ff08d1')} {c.original}
                      </p>
                      <p>
                        {t('m5f7e9ab243eb')} {c.corrected}
                      </p>
                      <p>{c.explanation}</p>
                    </div>
                  ))}
                </details>
              )}
            </article>
          ))}
        </details>
      ))}
    </section>
  );
}

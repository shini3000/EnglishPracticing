import { getTranslations } from 'next-intl/server';
import type { Sql } from '@/lib/db';
import { buildPracticeOverview } from '@/lib/progress/overview';

/** Optional streamed indicators: a failure must never prevent choosing a practice. */
export async function PracticeOverview({ sql, learnerId }: { sql: Sql; learnerId: string }) {
  const t = await getTranslations('ui');

  try {
    const overview = await buildPracticeOverview(sql, learnerId);
    if (!overview.sessions)
      return <p className="text-muted-foreground mt-4 text-sm leading-6">{t('ma15c2dd7fcc1')}</p>;
    return (
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
        <div>
          <dt>{t('md24c814bcd35')}</dt>
          <dd>
            {overview.practiceMinutes} <span>{t('m1f6fa6f69d18')}</span>
          </dd>
        </div>
        <div>
          <dt>{t('ma0f2448132c4')}</dt>
          <dd>{overview.currentStreakDays}</dd>
        </div>
        <div>
          <dt>{t('m272378aa56d8')}</dt>
          <dd>{overview.sessions}</dd>
        </div>
        <div>
          <dt>
            {t('mf27c68183983')}
            {overview.level.isProvisional ? t('m4e59d82f0506') : ''}
          </dt>
          <dd>{overview.level.band ?? t('mf7be7075ed8f')}</dd>
        </div>
      </dl>
    );
  } catch {
    return (
      <p role="status" className="text-muted-foreground mt-4 text-sm leading-6">
        {t('m3954df77a44d')}
      </p>
    );
  }
}

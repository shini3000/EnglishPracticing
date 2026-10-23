import { useLocale, useTranslations } from 'next-intl';
import { translateStatic } from '@/i18n/static-text';

type Correction = {
  [key: string]: unknown;
  learner_text?: unknown;
  corrected_text?: unknown;
  pattern?: unknown;
  explanation?: unknown;
  recovery_task?: unknown;
};

export function CorrectionCard({
  entry,
  number,
  source,
  date,
  answersVisible = true,
}: {
  entry: Correction;
  number?: number;
  source?: string;
  date?: string;
  answersVisible?: boolean;
}) {
  const t = useTranslations('ui');
  const locale = useLocale();

  const read = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const parsed = date?.includes('T') ? new Date(date) : null;
  const when =
    parsed && !Number.isNaN(parsed.getTime())
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'America/Bogota',
        }).format(parsed)
      : date;
  return (
    <article
      aria-label={number ? t('m76af9344395c', { v0: number }) : t('mf5f06a57d668')}
      className="correction-card"
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <h2 className="font-semibold">
          {number ? t('m76af9344395c', { v0: number }) : t('mf5f06a57d668')}
        </h2>
        <p className="text-muted-foreground text-xs">
          {translateStatic(t, source ?? '')}
          {when && (
            <>
              {' '}
              · <time dateTime={date}>{when}</time>
            </>
          )}
        </p>
      </header>
      <dl>
        <div className="correction-comparison">
          <div>
            <dt className="text-muted-foreground text-xs font-semibold">{t('m9399ee11688b')}</dt>
            <dd lang="en" className="mt-2 leading-7 whitespace-pre-wrap">
              {read(entry.learner_text)}
            </dd>
          </div>
          <div className="correction-answer">
            <dt className="text-primary text-xs font-semibold">{t('mb89f68931d3e')}</dt>
            <dd lang="en" className="mt-2 leading-7 whitespace-pre-wrap">
              {answersVisible ? read(entry.corrected_text) : t('m61de14fb5ee9')}
            </dd>
          </div>
        </div>
        {answersVisible &&
          [
            [t('m77350c0d891d'), entry.pattern],
            [t('mfd59d58ec34b'), entry.explanation],
            [t('m3b8a9ea044da'), entry.recovery_task],
          ].map(
            ([label, value]) =>
              read(value) && (
                <div key={String(label)} className="mt-5 border-t pt-4">
                  <dt className="text-muted-foreground text-xs font-semibold">{String(label)}</dt>
                  <dd className="mt-2 text-sm leading-7 whitespace-pre-wrap">{read(value)}</dd>
                </div>
              )
          )}
      </dl>
    </article>
  );
}

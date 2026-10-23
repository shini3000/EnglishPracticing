'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { CorrectionCard } from '@/components/app/correction-card';
import {
  type JournalEntry,
  correctionDay,
  correctionHistory,
  correctionsForDay,
} from '@/lib/correction-history';

export function CorrectionsHistory({
  entries,
  loading = false,
  available = true,
  queued = false,
  hasMore = false,
  selectedDay = correctionDay(new Date().toISOString()),
  days = [],
  onSelectDay,
}: {
  entries: JournalEntry[];
  loading?: boolean;
  available?: boolean;
  queued?: boolean;
  hasMore?: boolean;
  selectedDay?: string;
  days?: string[];
  onSelectDay?: (day: string) => void;
}) {
  const t = useTranslations('ui');
  const locale = useLocale();

  const [query, setQuery] = useState('');
  const [answersVisible, setAnswersVisible] = useState(true);
  const first = useRef<HTMLDivElement>(null);
  const corrections = correctionHistory(entries);
  const today = correctionDay(new Date().toISOString());
  const dayList = [
    ...new Set([
      today,
      selectedDay,
      ...days,
      ...corrections.map((item) => correctionDay(item.date)),
    ]),
  ]
    .filter(Boolean)
    .sort()
    .reverse();
  const dayIndex = dayList.indexOf(selectedDay);
  const current = correctionsForDay(corrections, selectedDay);
  const dayLabel = (day: string) =>
    day === today
      ? t('correctionsToday')
      : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(
          new Date(day + 'T12:00:00-05:00')
        );
  const filtered = current.filter((item) =>
    `${item.learner_text} ${item.corrected_text} ${item.pattern} ${item.explanation}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase())
  );
  return (
    <aside className="call-corrections" aria-label={t('m9698df8954be')}>
      <header className="corrections-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t('mdc7690cb7443')}</h1>
            <p className="text-muted-foreground mt-2 text-sm">{t('m69ce51fdb93e')}</p>
          </div>
          <span
            role="status"
            aria-live="polite"
            className="bg-secondary rounded-full px-3 py-1 text-sm"
          >
            {t('correctionCount', { count: current.length })}
          </span>
        </div>
        <nav className="mt-4 flex flex-wrap items-center gap-3" aria-label={t('correctionsByDay')}>
          <button
            className="study-text-link"
            disabled={!onSelectDay || dayIndex >= dayList.length - 1 || loading}
            onClick={() => onSelectDay?.(dayList[dayIndex + 1])}
          >
            {t('correctionsOlderDay')}
          </button>
          <label className="min-w-36 flex-1 text-sm">
            <span className="sr-only">{t('correctionsByDay')}</span>
            <select
              className="study-field mt-0"
              value={selectedDay}
              disabled={!onSelectDay || loading}
              onChange={(event) => onSelectDay?.(event.target.value)}
            >
              {dayList.map((day) => (
                <option key={day} value={day}>
                  {dayLabel(day)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="study-text-link"
            disabled={!onSelectDay || dayIndex <= 0 || loading}
            onClick={() => onSelectDay?.(dayList[dayIndex - 1])}
          >
            {t('correctionsNewerDay')}
          </button>
        </nav>
        <label className="mt-4 block text-sm">
          {t('mdd960d27697b')}
          <input
            className="study-field"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('m4ec4d66783ee')}
          />
        </label>
        <div className="corrections-actions">
          <button
            className="study-text-link"
            aria-pressed={!answersVisible}
            onClick={() => setAnswersVisible((visible) => !visible)}
          >
            {answersVisible ? t('m018ed046c6d5') : t('ma85c3e4d2830')}
          </button>
          <button
            className="study-text-link"
            disabled={loading}
            onClick={() => {
              setQuery('');
              onSelectDay?.(today);
              requestAnimationFrame(() =>
                first.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
              );
            }}
          >
            {t('correctionsGoToday')}
          </button>
          <Link
            href="/progress"
            className="study-text-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('m57b124de718c')}
          </Link>
        </div>
      </header>
      <div className="corrections-list">
        {loading && (
          <p role="status" className="text-muted-foreground mb-4 text-sm">
            {t('m5a8d0cd0279e')}
          </p>
        )}
        {!available && (
          <p role="status" className="mb-4 rounded-lg border p-3 text-sm">
            {queued ? t('m72c15aa820b0') : t('m6008f313e660')}
          </p>
        )}
        <div ref={first} />
        {!loading && current.length === 0 && (
          <div className="rounded-xl border border-dashed p-6">
            <h2 className="font-semibold">{t('md5fb1dbe1189')}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {t('correctionsEmptyDay')}
            </p>
          </div>
        )}
        {query && filtered.length === 0 && <p role="status">{t('mb7c92d141180')}</p>}
        <ol className="space-y-5">
          {filtered.map((item) => (
            <li key={item.id}>
              <CorrectionCard
                entry={item}
                number={current.length - current.indexOf(item)}
                source={item.source}
                date={item.date}
                answersVisible={answersVisible}
              />
            </li>
          ))}
        </ol>
        {hasMore && <p className="text-muted-foreground mt-5 text-xs">{t('m9ac9f0515029')}</p>}
      </div>
    </aside>
  );
}

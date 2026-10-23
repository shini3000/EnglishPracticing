'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { translateStatic } from '@/i18n/static-text';
import type { LearningSummary } from '@/lib/progress/learning';

export function LearningDashboard({ initial }: { initial: LearningSummary }) {
  const t = useTranslations('ui');

  const [summary, setSummary] = useState(initial);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/learning-progress', { cache: 'no-store' });
      if (!res.ok) throw new Error(t('m0580380f9c0e'));
      const next = await res.json();
      if (!next.available) throw new Error(t('mfe5901c4a751'));
      setSummary(next);
    } catch {
      setError(t('me4bed5ea134b'));
    } finally {
      setBusy(false);
    }
  }
  const items = summary.items.filter(
    (i) => filter === 'all' || i.item_type === filter || (filter === 'due' && i.due)
  );
  const total = summary.totals;
  return (
    <section className="mb-10 space-y-5" aria-label={t('m71ce43881086')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('me9c2b988af2c')}</h2>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm">{t('me3652e980d21')}</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={busy}>
          {busy ? t('m211b1c37458e') : t('meea6aee2018f')}
        </Button>
      </div>
      {error && (
        <p role="status" className="text-sm">
          {error}
        </p>
      )}
      {!summary.available ? (
        <p className="rounded-lg border p-4">{t('m47c94f2657c7')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [t('meef77ef9144a'), total.introduced],
              [t('ma8cec9edb9a0'), total.consolidating],
              [t('md9801725bc9f'), total.consolidated],
              [t('m08944353c48c'), total.due],
              [t('m12f7b5100eef'), total.practiceDays],
              [t('m322f96a221d4'), total.measuredMinutes],
              [t('mdecd81751ee6'), total.unaided],
              [
                t('m235fe86d5bde'),
                total.successRate === null ? t('m03dc8297d3d6') : total.successRate + '%',
              ],
            ].map(([label, value]) => (
              <div key={label} className="bg-card rounded-xl border p-5">
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {t('md4e884916872')} {total.vocabulary} {t('m50e7e762d89a')} {total.structures}{' '}
            {t('m30c5c380fa14')} {total.helped} {t('m72987603cb50')} {total.failed}{' '}
            {t('m10a3f0229fd3')}
          </p>
          <div className="rounded-xl border p-4">
            <h2 className="font-semibold">{t('m9b284c37b2d9')}</h2>
            {summary.trend.length === 0 ? (
              <p className="mt-3 text-sm">{t('m72cdfc95748a')}</p>
            ) : (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="unaided" name={t('m6c9a5a5ee0a0')} fill="#15803d" />
                    <Bar dataKey="helped" name={t('m707d40c295e6')} fill="#d97706" />
                    <Bar dataKey="failed" name={t('m184f9f08775f')} fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">{t('m451e394a9899')}</h2>
            <select
              aria-label={t('m05f761f6c824')}
              className="bg-background rounded border p-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{t('mbd02b9a7d71d')}</option>
              <option value="vocabulary">{t('m6002766a4ef3')}</option>
              <option value="structure">{t('m353f159e8bb2')}</option>
              <option value="due">{t('m08944353c48c')}</option>
            </select>
          </div>
          {!items.length && <p className="text-muted-foreground text-sm">{t('mbe4bfc70cc6d')}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.item_type + item.key} className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">
                  {item.item_type === 'structure' ? t('m77350c0d891d') : t('m6002766a4ef3')}
                </p>
                <h3 className="mt-1 font-semibold">{item.label}</h3>
                <p className="mt-1 text-sm">{translateStatic(t, item.state)}</p>
                <p className="text-muted-foreground mt-2 text-xs">
                  {t('m85e99c2d3c42')} {item.successful_days.length}/{item.policy.min_days}{' '}
                  {t('m880c49c315e9')} {item.span_days}/{item.policy.min_span_days}{' '}
                  {t('m457927e06dad')} {item.context_count}/{item.policy.min_contexts}
                </p>
                <p className="mt-2 text-xs">
                  {t('m3a4c9125ea8a')} {item.next_review ?? t('m7a7455300406')}{' '}
                  {item.due ? t('mdff91ab03abe') : ''}
                </p>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer">
                    {t('attemptCount', { count: item.attempt_count })}
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {item.attempts.map((attempt, index) => (
                      <li key={index} className="border-t pt-2 text-xs">
                        {attempt.date} ·{' '}
                        {attempt.result === 'unaided'
                          ? t('m6c9a5a5ee0a0')
                          : attempt.result === 'helped'
                            ? t('m707d40c295e6')
                            : t('m184f9f08775f')}{' '}
                        · {attempt.context || t('mc021647bd8da')}
                        <p className="mt-1">{attempt.evidence}</p>
                        {(!attempt.observed ||
                          attempt.attempt_type === 'repetition' ||
                          attempt.attempt_type === 'legacy') && (
                          <p className="text-muted-foreground">{t('mcbcbeb840351')}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

'use client';

import { Fragment, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DeltaChip } from '@/components/progress/parameter-card';
import { Card } from '@/components/ui/card';
import { translateStatic } from '@/i18n/static-text';
import { buildGroupReport } from '@/lib/progress/analysis';
import { formatShortDate } from '@/lib/progress/dates';
import { PARAMETER_GROUPS, formatterFor } from '@/lib/progress/parameters';
import type { GroupedParameter, ParameterSummary, SessionGroup } from '@/lib/progress/types';

/**
 * The trajectory report: the learner's history in sequential groups of sessions, one row per
 * parameter — the view that says whether each stretch of practice beat the one before, which
 * session-to-session lines are too noisy to answer.
 *
 * TABLE FIRST, BARS SECOND. The numbers are the content and are rendered as text in text
 * colours; the bar under each value is a redundant visual channel for scanning, scaled within
 * its own row. Identity and verdict never ride on colour alone — the verdict chip carries an
 * icon and a word (same rule as everywhere else on this page), and the bars are all the one
 * series colour because every row is a single measure of a single learner.
 *
 * A missing cell is "—", not an empty bar: a group where nothing could be measured is an
 * unknown, and drawing a zero-length bar would read as a zero. Same rule as the charts.
 */

/** Bar length as a share of the row's own scale. Ordinal (CEFR) rows use the fixed 6-band scale. */
function barFraction(value: number, rowMax: number, ordinal: boolean): number {
  const max = ordinal ? 6 : rowMax;
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, value / max));
}

function ValueCell({ parameter, index }: { parameter: GroupedParameter; index: number }) {
  const t = useTranslations('ui');

  const value = parameter.values[index];
  const format = formatterFor(parameter.key);

  if (value === null) {
    return (
      <td className="px-3 py-2.5 align-top">
        <span className="text-muted-foreground text-sm" title={t('m152a80b52680')}>
          —
        </span>
      </td>
    );
  }

  const rowMax = Math.max(...parameter.values.filter((v): v is number => v !== null));
  const fraction = barFraction(value, rowMax, parameter.ordinal);

  return (
    <td className="px-3 py-2.5 align-top">
      <div className="text-card-foreground text-sm font-medium tabular-nums">{format(value)}</div>
      <div
        className="mt-1 h-1 w-full max-w-16 rounded-full"
        style={{ background: 'var(--viz-grid)' }}
        aria-hidden
      >
        <div
          className="h-1 rounded-full"
          style={{ width: `${Math.round(fraction * 100)}%`, background: 'var(--viz-series)' }}
        />
      </div>
    </td>
  );
}

function ParameterRow({
  parameter,
  groups,
}: {
  parameter: GroupedParameter;
  groups: SessionGroup[];
}) {
  const t = useTranslations('ui');

  return (
    <tr className="border-border border-b last:border-b-0">
      <td className="text-card-foreground px-3 py-2.5 align-top text-sm">
        {translateStatic(t, parameter.label)}
      </td>
      {groups.map((group, index) => (
        <ValueCell key={group.label} parameter={parameter} index={index} />
      ))}
      <td className="px-3 py-2.5 align-top">
        {parameter.delta ? (
          <DeltaChip delta={parameter.delta} parameterKey={parameter.key} suffix="" />
        ) : (
          <span className="text-muted-foreground text-[11px]">
            {parameter.cumulative ? t('m285f01adda3c') : t('m459c0288b77a')}
          </span>
        )}
      </td>
    </tr>
  );
}

export function TrajectoryReport({ parameters }: { parameters: ParameterSummary[] }) {
  const t = useTranslations('ui');

  const locale = useLocale();
  const report = useMemo(() => buildGroupReport(parameters), [parameters]);

  return (
    <section className="mb-8">
      <h2 className="text-foreground mb-1 text-lg font-semibold">{t('m308f2900f615')}</h2>
      <p className="text-muted-foreground mb-4 max-w-prose text-sm leading-6">
        {report ? (
          <>
            {t('m9e58c6b6ee03')} {report.groupSize} {t('m4dca94105d86')}{' '}
            <span className="text-foreground font-medium">{t('mc1deb3268b97')}</span>{' '}
            {t('mea6dc681daf5')}
          </>
        ) : (
          <>{t('m2e72b73ec956')}</>
        )}
      </p>

      {report === null ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-sm leading-6">{t('m917e999c1dff')}</p>
        </Card>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-3 py-3 text-xs font-medium">
                  {t('mdd066ec1bf1d')}
                </th>
                {report.groups.map((group) => (
                  <th key={group.label} className="px-3 py-3">
                    <div className="text-card-foreground text-xs font-semibold whitespace-nowrap">
                      {t('m6fa3cbf451b2')} {group.label}
                    </div>
                    <div className="text-muted-foreground text-[10px] font-normal whitespace-nowrap">
                      {formatShortDate(group.startDate, locale)}
                      {group.startDate.slice(0, 10) === group.endDate.slice(0, 10)
                        ? ''
                        : ` – ${formatShortDate(group.endDate, locale)}`}
                    </div>
                  </th>
                ))}
                <th className="text-muted-foreground px-3 py-3 text-xs font-medium">
                  {t('m715b1458abbe')}
                </th>
              </tr>
            </thead>
            <tbody>
              {PARAMETER_GROUPS.map((group) => {
                const rows = report.parameters.filter((parameter) => parameter.group === group.key);
                if (rows.length === 0) {
                  return null;
                }
                return (
                  <Fragment key={group.key}>
                    <tr className="border-border border-b">
                      <th
                        colSpan={report.groups.length + 2}
                        className="text-muted-foreground bg-muted/40 px-3 py-2 text-left text-[11px] font-semibold tracking-wide uppercase"
                      >
                        {translateStatic(t, group.title)}
                      </th>
                    </tr>
                    {rows.map((parameter) => (
                      <ParameterRow
                        key={parameter.key}
                        parameter={parameter}
                        groups={report.groups}
                      />
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {report !== null && (
        <p className="text-muted-foreground mt-2 text-[11px] leading-4">{t('m5c4808e10e59')}</p>
      )}
    </section>
  );
}

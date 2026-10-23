'use client';

import { useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatterFor } from '@/lib/progress/parameters';
import type { ParameterSummary } from '@/lib/progress/types';

/**
 * One parameter, over the learner's sessions.
 *
 * TWO LINES, ONE MEASURE. The rule this file has always enforced — never two measures on one
 * chart — still holds, and this does not break it: both lines are the SAME parameter on the SAME
 * y-scale. The faint one is what each session measured; the bold one is the rolling mean, and it
 * is the one the learner should read. A dual-axis chart lets you manufacture any correlation you
 * like by sliding one axis, and remains the single most misleading thing you can put on a
 * dashboard. Two *measures* still means two of these.
 *
 * WHY BOTH LINES. Showing only the raw values asks a learner to eyeball a trend out of noise that
 * is mostly topic, not skill. Showing only the smoothed line hides how much scatter it was drawn
 * through, which is a quiet way of overclaiming. Drawing both says exactly what we know and how
 * firmly we know it.
 *
 * Nulls are gaps, not zeros. `connectNulls={false}` is load-bearing on BOTH lines: an ungraded
 * session has an *unknown* value, and joining the line straight across it would draw a confident
 * trend through the exact point where we knew nothing.
 */

const AXIS_STYLE = {
  fontSize: 11,
  fill: 'var(--viz-axis)',
} as const;

export function TrendChart({
  parameter,
  height = 176,
}: {
  parameter: ParameterSummary;
  height?: number;
}) {
  const t = useTranslations('ui');

  const format = formatterFor(parameter.key);

  if (parameter.knownCount < 2) {
    return (
      <div
        className="text-muted-foreground flex items-center justify-center text-center text-xs"
        style={{ height }}
      >
        {parameter.knownCount === 0 ? t('m07d417d868a4') : t('m30ade2975d83')}
      </div>
    );
  }

  return (
    <div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={parameter.points} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--viz-grid)" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="sessionIndex"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-grid)' }}
              tickFormatter={(v) => `#${v}`}
            />
            <YAxis
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => format(v)}
            />
            <Tooltip
              cursor={{ stroke: 'var(--viz-axis)', strokeWidth: 1 }}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--popover-foreground)',
              }}
              labelFormatter={(v) => t('mf1af9e2bbeb0', { v0: v })}
              formatter={(value, name) =>
                [
                  format(Number(value)),
                  name === 'smoothed' ? t('m9e217716c4e0') : t('m6da6530a0728'),
                ] as [string, string]
              }
            />

            {/* Each session as measured. Deliberately quiet: it is evidence, not the message. */}
            <Line
              type="linear"
              dataKey="value"
              stroke="var(--viz-axis)"
              strokeWidth={1}
              strokeOpacity={0.45}
              dot={{ r: 2, fill: 'var(--viz-axis)', fillOpacity: 0.6, strokeWidth: 0 }}
              activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />

            {/* The trend. This is the line the learner reads. */}
            <Line
              type="monotone"
              dataKey="smoothed"
              stroke="var(--viz-series)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Said in words, because the difference between the two lines is the difference between
          "this is what happened" and "this is what it means", and a learner who mistakes one for
          the other will read noise as regression. */}
      <p className="text-muted-foreground mt-2 text-[11px] leading-4">{t('m3ec6046ac07f')}</p>
    </div>
  );
}

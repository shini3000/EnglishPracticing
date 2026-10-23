'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ParameterCard } from '@/components/progress/parameter-card';
import { SessionExplorer } from '@/components/progress/session-explorer';
import { StatTile } from '@/components/progress/stat-tile';
import { TrajectoryReport } from '@/components/progress/trajectory-report';
import { StrengthCard, WeaknessCard } from '@/components/progress/weakness-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { translateStatic } from '@/i18n/static-text';
import { PARAMETER_GROUPS } from '@/lib/progress/parameters';
import { CEFR_LEVELS, type ParameterSummary, type ProgressSummary } from '@/lib/progress/types';

/**
 * The dashboard. Rendering only — every number on this page was decided in
 * lib/progress/analysis.ts, and nothing here computes anything beyond formatting.
 *
 * The page answers three questions, in this order, because that is the order a learner
 * actually asks them:
 *
 *   1. Where am I?            → the level band, and the honest confidence in it
 *   2. What should I fix?     → weak areas, regressions first
 *   3. Am I getting better?   → the trend charts
 *
 * A learner who only reads the first screen still gets the useful part.
 *
 * Rendered inside AppShell, which owns the page frame — the width, padding and header live
 * there, not here.
 */

const LEVEL_BLURB: Record<string, string> = {
  A1: 'Just starting — words and set phrases.',
  A2: 'Simple sentences on familiar topics.',
  B1: 'You can hold a conversation and cope when it goes off-script.',
  B2: 'Fluent and spontaneous; you can argue a point.',
  C1: 'Precise and flexible, with real subtlety.',
  C2: 'Effortless and idiomatic.',
};

function LevelCard({ summary }: { summary: ProgressSummary }) {
  const t = useTranslations('ui');

  const { level } = summary;

  if (!level.band) {
    return (
      <Card className="p-6">
        <h2 className="text-card-foreground text-sm font-semibold">{t('m5f0a4073704d')}</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{t('me03d818a6154')}</p>
      </Card>
    );
  }

  const percent = Math.round(level.confidence * 100);

  return (
    <Card className="p-6">
      <h2 className="text-card-foreground text-sm font-semibold">{t('m5f0a4073704d')}</h2>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-card-foreground text-5xl leading-none font-semibold tracking-tight">
          {level.band}
        </span>
        <span className="text-muted-foreground text-sm">
          {translateStatic(t, LEVEL_BLURB[level.band])}
        </span>
      </div>

      {/* The CEFR scale, with the learner's position marked. A bare "B1" means nothing to
          someone who has never met the CEFR scale — which is most people. */}
      <div className="mt-5 flex gap-1" aria-hidden>
        {CEFR_LEVELS.map((band) => {
          const reached = level.numeric !== null && CEFR_LEVELS.indexOf(band) + 1 <= level.numeric;
          return (
            <div key={band} className="flex-1">
              <div
                className="h-1.5 rounded-full"
                style={{
                  background: reached ? 'var(--viz-series)' : 'var(--viz-grid)',
                }}
              />
              <div
                className="mt-1.5 text-center text-[10px] font-medium"
                style={{
                  color: band === level.band ? 'var(--viz-series)' : 'var(--viz-axis)',
                }}
              >
                {band}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confidence is stated, not buried. An estimate from two short sessions is a guess, and
          saying so is what makes the number worth anything at all. */}
      <p className="text-muted-foreground mt-4 text-xs leading-5">
        {level.isProvisional ? (
          <>{t('gradedEvidence', { count: level.gradedSessions })}</>
        ) : (
          <>{t('confidenceEvidence', { count: level.gradedSessions, percent })}</>
        )}
      </p>
    </Card>
  );
}

function EmptyState() {
  const t = useTranslations('ui');

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-foreground text-xl font-semibold">{t('mfd0e67f002f7')}</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-6">{t('m2f4902fc0926')}</p>
      <Button asChild size="lg" className="mt-6 rounded-full">
        <Link href="/call">{t('ma5e3cc5d34c6')}</Link>
      </Button>
    </div>
  );
}

/**
 * One group of parameters — Accuracy, Vocabulary, Delivery, and so on.
 *
 * Grouped, and collapsed to cards rather than laid out as a wall of full-size charts. There are
 * thirteen parameters plus one per kind of mistake; thirteen charts is a page nobody scrolls to
 * the bottom of, and a parameter nobody reads is worth exactly as much as one nobody records.
 * The card carries the answer — where you are, how far you have come — and the chart is one
 * click away for the learner who wants to see the working.
 */
function ParameterGroupSection({
  title,
  blurb,
  parameters,
}: {
  title: string;
  blurb: string;
  parameters: ParameterSummary[];
}) {
  const t = useTranslations('ui');

  if (parameters.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <h3 className="text-foreground mb-1 text-base font-semibold">{translateStatic(t, title)}</h3>
      <p className="text-muted-foreground mb-4 max-w-prose text-sm leading-6">
        {translateStatic(t, blurb)}
      </p>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {parameters.map((parameter) => (
          <ParameterCard key={parameter.key} parameter={parameter} />
        ))}
      </ul>
    </section>
  );
}

export function Dashboard({ summary }: { summary: ProgressSummary }) {
  const t = useTranslations('ui');

  const { totals, parameters, strengths, weaknesses, recentCorrections, dataQuality } = summary;

  if (totals.sessions === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">
            {t('m433a720b7e1d')}
          </h1>
          {summary.latestSummary && (
            <p className="text-muted-foreground mt-2 max-w-prose text-sm leading-6">
              {summary.latestSummary}
            </p>
          )}
        </div>
        <Button asChild className="rounded-full">
          <Link href="/call">{t('m5154621cce5c')}</Link>
        </Button>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t('m6fa3cbf451b2')} value={String(totals.sessions)} />
        <StatTile
          label={t('m0280f4c411e9')}
          value={t('m4a1b30338cd5', { v0: totals.practiceMinutes })}
          hint={t('m7c3a0d52e715', { v0: totals.wordsSpoken.toLocaleString() })}
        />
        <StatTile
          label={t('m7245a9e5643f')}
          value={totals.vocabularySize.toLocaleString()}
          hint={t('m7b60c1eb00fa')}
        />
        <StatTile
          label={t('m41db983fdf4e')}
          value={t('dayCount', { count: totals.currentStreakDays })}
          hint={t('ma587b4eb2b9e')}
        />
      </section>

      <section className="mb-8">
        <LevelCard summary={summary} />
      </section>

      {weaknesses.length > 0 && (
        <section className="mb-8">
          <h2 className="text-foreground mb-1 text-lg font-semibold">{t('meb888732f44f')}</h2>
          <p className="text-muted-foreground mb-4 text-sm leading-6">{t('mc9d58083a4a9')}</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {weaknesses.slice(0, 6).map((weakness) => (
              <WeaknessCard key={`${weakness.category}-${weakness.label}`} weakness={weakness} />
            ))}
          </ul>
        </section>
      )}

      {strengths.length > 0 && (
        <section className="mb-8">
          <h2 className="text-foreground mb-4 text-lg font-semibold">{t('mc24e37b6ae75')}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {strengths.slice(0, 4).map((strength) => (
              <StrengthCard key={strength.label} strength={strength} />
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-foreground mb-1 text-lg font-semibold">{t('md46fecb126b8')}</h2>
        <p className="text-muted-foreground mb-6 max-w-prose text-sm leading-6">
          {t('mbe3f91e048fb')}{' '}
          <span className="text-foreground font-medium">{t('maec954e12878')}</span>{' '}
          {t('m1844a67ea2c0')}{' '}
          <span className="text-foreground font-medium">{t('m2b0fa6cd1bf5')}</span>{' '}
          {t('mab81d351d33a')}
        </p>

        {PARAMETER_GROUPS.map((group) => (
          <ParameterGroupSection
            key={group.key}
            title={group.title}
            blurb={group.blurb}
            parameters={parameters.filter((parameter) => parameter.group === group.key)}
          />
        ))}
      </section>

      <TrajectoryReport parameters={parameters} />

      <SessionExplorer summary={summary} />

      {recentCorrections.length > 0 && (
        <section className="mb-8">
          <h2 className="text-foreground mb-4 text-lg font-semibold">{t('m3b698b096f05')}</h2>
          <ul className="divide-border bg-card border-border divide-y rounded-xl border">
            {recentCorrections.map((correction, index) => (
              <li key={index} className="p-4">
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="text-muted-foreground line-through decoration-1">
                    {correction.learner_text}
                  </span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="text-card-foreground font-medium">
                    {correction.corrected_text}
                  </span>
                </div>
                {correction.explanation && (
                  <p className="text-muted-foreground mt-1.5 text-xs leading-5">
                    {correction.explanation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        The honesty footer. Grammar scoring runs on a speech-to-text transcript, and Whisper
        both repairs some mistakes and invents others. A learner who sees a correction they
        know they didn't say deserves to understand why, instead of concluding the tutor is
        broken — and a learner acting on these numbers deserves to know what they rest on.
      */}
      <footer className="text-muted-foreground border-border border-t pt-6 text-xs leading-5">
        <p className="max-w-prose">
          <span className="text-foreground font-medium">{t('m89d03b25d914')}</span>{' '}
          {t('m40d4bb5b2aa0')} <em>{t('m254bb97b57f1')}</em> {t('me1ed87feb465')}
        </p>
        {dataQuality.ungradedSessions > 0 && (
          <p className="mt-2 max-w-prose">
            {dataQuality.ungradedSessions} {t('m9cec8b5eba8b')} {totals.sessions}{' '}
            {t('mf38a5114b1a9')}
          </p>
        )}
      </footer>
    </div>
  );
}

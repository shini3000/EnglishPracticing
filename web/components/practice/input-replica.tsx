'use client';

import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
import { useTimerAlarm } from '@/hooks/use-timer-alarm';
import { translateStatic } from '@/i18n/static-text';
import { INPUT_REPLICA_STEPS, initialInputClock, inputClock } from '@/lib/input-replica';

export function InputReplica() {
  const t = useTranslations('ui');

  const [clock, dispatch] = useReducer(inputClock, initialInputClock);
  useTimerAlarm({
    key: `input:${clock.index}`,
    remaining: clock.remaining,
    running: clock.deadline !== null,
    active: !clock.finished,
  });
  useEffect(() => {
    if (clock.deadline === null) return;
    const interval = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 250);
    return () => clearInterval(interval);
  }, [clock.deadline]);
  const step = INPUT_REPLICA_STEPS[clock.index];
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/practice-b" className="study-text-link text-sm">
        {t('m2c8f13ef3250')}
      </Link>
      <FluencyBlocks current={2} />
      <p className="text-muted-foreground mt-8 text-sm">{t('m6e3fe2f49945')}</p>
      <h1 className="study-title mt-3">{t('m1c92cc731eef')}</h1>
      <p className="text-muted-foreground mt-5 leading-7">{t('m57dc5f30ce4f')}</p>
      <section className="bg-card mt-8 rounded-2xl border p-6" aria-labelledby="input-step">
        <p className="text-muted-foreground text-sm">
          {t('m2b88f694472f')} {clock.index + 1} {t('m33a028fbdd8d')}
        </p>
        <h2 id="input-step" className="mt-2 text-xl font-semibold">
          {translateStatic(t, step.title)}
        </h2>
        <p className="mt-4 leading-7">{translateStatic(t, step.instruction)}</p>
        <p
          role="timer"
          aria-label={t('mb4b4be422cd1')}
          className="my-6 font-mono text-5xl tabular-nums"
        >
          {Math.floor(clock.remaining / 60)}:{String(clock.remaining % 60).padStart(2, '0')}
        </p>
        <p role="status" className="text-muted-foreground text-sm">
          {clock.finished
            ? t('mc11db8f66cc2')
            : clock.remaining === 0
              ? t('m678ba6fffbf0')
              : clock.deadline !== null
                ? t('m7d47affb8591')
                : t('m4bb356d6be54')}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!clock.finished && (
            <>
              <button
                className="study-button disabled:opacity-50"
                disabled={clock.remaining === 0}
                onClick={() =>
                  dispatch({ type: clock.deadline === null ? 'start' : 'pause', now: Date.now() })
                }
              >
                {clock.deadline === null ? t('m43277b389284') : t('mcd25ee5b1db8')}
              </button>
              <button className="study-text-link" onClick={() => dispatch({ type: 'next' })}>
                {clock.index === 3 ? t('mce7929a98e82') : t('m72a0f0ddfef4')}
              </button>
            </>
          )}
          <button className="study-text-link" onClick={() => dispatch({ type: 'reset' })}>
            {t('m80dcc9888e05')}
          </button>
        </div>
      </section>
      <ol className="mt-6 space-y-2" aria-label={t('m7aa453aebad0')}>
        {INPUT_REPLICA_STEPS.map((item, index) => (
          <li
            key={translateStatic(t, item.title)}
            aria-current={!clock.finished && index === clock.index ? 'step' : undefined}
            className={`border-l-2 py-2 pl-4 ${index === clock.index ? 'border-primary text-primary' : 'text-muted-foreground'}`}
          >
            {index + 1}. {translateStatic(t, item.title)} · {item.seconds / 60} {t('m1f6fa6f69d18')}
          </li>
        ))}
      </ol>
      <Link href="/practice-b/agility" className="study-button mt-8">
        {t('mb89f6df6b5f4')}
      </Link>
      <p className="text-muted-foreground mt-3 text-xs">{t('mcfa653affd96')}</p>
    </main>
  );
}

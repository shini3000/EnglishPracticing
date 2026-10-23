'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
import { useDrillCall } from '@/hooks/use-drill-call';
import { useTimerAlarm } from '@/hooks/use-timer-alarm';
import { translateStatic } from '@/i18n/static-text';
import { NATIVE_LANGUAGES, type NativeLanguage } from '@/lib/practice-options';
import { AGILITY_ROUNDS, type DrillCorrection } from '@/lib/time-shifting';

type Review = {
  corrections: DrillCorrection[];
  feedback: string;
  saved: boolean;
  reused?: boolean;
};
type Phase = 'setup' | 'ready' | 'speaking' | 'rest' | 'done';

export function AgilityDrill({ agentName }: { agentName?: string }) {
  const t = useTranslations('ui');

  const call = useDrillCall('agility');
  const [topic, setTopic] = useState('');
  const language = useLocale() as NativeLanguage;
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState('');
  const [transcripts, setTranscripts] = useState<Record<number, string>>({});
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alarm = useTimerAlarm({
    key: `${phase}:${round}`,
    remaining,
    running,
    active: phase !== 'done' && phase !== 'ready',
  });
  const stopAt = useRef(0);
  useEffect(() => {
    if (!running) return;
    stopAt.current = Date.now() + remaining * 1000;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((stopAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setRunning(false);
    }, 250);
    return () => clearInterval(interval);
    // Capture the remaining duration only on start/resume; expiry never closes speech.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  useEffect(() => {
    if (call.capturing) setText(call.text);
  }, [call.text, call.capturing]);
  useEffect(() => {
    if (!call.connected && phase === 'speaking') setRunning(false);
  }, [call.connected, phase]);

  async function review(index: number, transcript: string) {
    const form = new FormData();
    form.set('exercise', 'agility');
    form.set('step', String(index));
    form.set('routine', topic);
    form.set('language', language);
    form.set('text', transcript);
    form.set('previousPresent', index > 0 ? (transcripts[0] ?? '') : '');
    const response = await fetch('/api/time-shifting', { method: 'POST', body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('m760a66f12aee'));
    setReviews((previous) => ({ ...previous, [index]: result }));
  }
  async function startRound() {
    setError('');
    try {
      await call.begin();
      setText('');
      setRemaining(AGILITY_ROUNDS[round].seconds);
      setPhase('speaking');
      setRunning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('m5440b7706814'));
    }
  }
  async function finishRound() {
    setBusy(true);
    setError('');
    setRunning(false);
    try {
      const transcript = await call.finish();
      setText(transcript);
      setTranscripts((previous) => ({ ...previous, [round]: transcript }));
      // Breathing time starts after the microphone closes, not after the model answers.
      setPhase(round < 2 ? 'rest' : 'done');
      setRemaining(round < 2 ? 30 : 0);
      setRunning(round < 2);
      if (round === 2) await call.disconnect();
      await review(round, transcript);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('m1386334880fc'));
    } finally {
      setBusy(false);
    }
  }
  async function retryReview(index: number) {
    setBusy(true);
    setError('');
    try {
      await review(index, transcripts[index]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mc23d2823183a'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/practice-b" className="study-text-link text-sm">
        {t('m2c8f13ef3250')}
      </Link>
      <FluencyBlocks current={3} disabled={call.capturing || busy || call.pending} />
      <p className="text-muted-foreground mt-8 text-sm">{t('m036e1862afe1')}</p>
      <h1 className="study-title mt-3">{t('ma3c9e2127e0e')}</h1>
      <p className="text-muted-foreground mt-5 leading-7">{t('mfb1db8dcbb0e')}</p>
      <label className="mt-6 block text-sm">
        {t('m3920792993e7')}
        <input
          className="study-field"
          value={topic}
          maxLength={500}
          disabled={phase !== 'setup'}
          placeholder={t('m26cb9a9d148c')}
          onChange={(event) => setTopic(event.target.value)}
        />
      </label>
      <p className="text-muted-foreground mt-4 text-sm">
        {t('medca6f0ab6be')} {translateStatic(t, NATIVE_LANGUAGES[language])}.{' '}
        <Link href="/profile" className="study-text-link">
          {t('m1096db3ab260')}
        </Link>
      </p>
      <section
        className="bg-card mt-6 space-y-4 rounded-2xl border p-6"
        aria-label={t('m27ab6a070612')}
      >
        {(phase === 'ready' || phase === 'speaking') && (
          <p className="text-sm leading-6">
            {[t('m5c40576fd16d'), t('m53f7ef65bdb0'), t('mcbbd66177456')][round]}
          </p>
        )}
        <h2 className="text-xl font-semibold">
          {phase === 'setup'
            ? t('m739eb8706cc5')
            : phase === 'rest'
              ? t('m82e65dbb5377')
              : phase === 'done'
                ? t('m18b6977faeb5')
                : translateStatic(t, AGILITY_ROUNDS[round].label)}
        </h2>
        <p role="timer" aria-label={t('mb4b4be422cd1')} className="font-mono text-5xl tabular-nums">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </p>
        <p role="status" className="text-muted-foreground text-sm">
          {phase === 'rest'
            ? t('mfac036cfe318')
            : phase === 'setup'
              ? t('m7937823954bd')
              : call.capturing
                ? t('mbb241120b81a')
                : t('m25d60c13ce31')}
        </p>
        {phase === 'setup' && (
          <div className="border-primary bg-secondary/40 rounded-lg border-l-2 p-4 text-sm leading-6">
            <p className="font-semibold">{t('agilityPreparationTitle')}</p>
            <p className="mt-2">{t('agilityPreparationHelp')}</p>
            <p className="mt-2">{t('agilityPreparationExample')}</p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4 border-t pt-5">
          {(phase === 'setup' || phase === 'rest' || phase === 'speaking') && (
            <button
              className="study-text-link"
              disabled={remaining === 0}
              onClick={() => setRunning((value) => !value)}
            >
              {running ? t('ma0dfa43d802c') : t('ma1e66886377a')}
            </button>
          )}
          {phase === 'setup' && (
            <button
              className="study-button"
              disabled={!topic.trim()}
              onClick={() => {
                setPhase('ready');
                setRunning(false);
                setRemaining(240);
              }}
            >
              {t('m6a576f39dd92')}
            </button>
          )}
          {phase === 'rest' && (
            <button
              className="study-button"
              disabled={remaining > 0 || busy || call.pending}
              onClick={() => {
                setRound((value) => value + 1);
                setPhase('ready');
                setRemaining(AGILITY_ROUNDS[round + 1].seconds);
                setText('');
              }}
            >
              {t('m246023814436')}
            </button>
          )}
          {phase === 'ready' &&
            (!call.connected ? (
              <button
                className="study-button"
                disabled={call.pending}
                onClick={() => void call.connect(language, agentName)}
              >
                {t('m209a32ac16fa')}
              </button>
            ) : (
              <button
                className="study-button"
                disabled={!call.ready || call.pending || busy}
                onClick={() => void startRound()}
              >
                {call.ready ? t('m183979411e7e') : t('md7a25fb4ef88')}
              </button>
            ))}
          {phase === 'speaking' && call.capturing && (
            <button
              className="study-button"
              disabled={busy || call.pending}
              onClick={() => void finishRound()}
            >
              {t('me7d277877b60')}
            </button>
          )}
          {phase === 'speaking' && !call.capturing && (
            <p>
              {t('m3680cf57d045')}{' '}
              <button
                className="study-text-link"
                disabled={busy || call.pending}
                onClick={() => setPhase('ready')}
              >
                {t('md1c6c8c94970')}
              </button>
            </p>
          )}
          {call.connected && (
            <button
              className="study-text-link"
              disabled={busy || call.pending}
              onClick={() => void call.disconnect()}
            >
              {t('m11bfc54fb18d')}
            </button>
          )}
        </div>
        {!alarm.ready && (
          <button className="study-text-link text-xs" onClick={() => void alarm.enable()}>
            {t('timerEnableSound')}
          </button>
        )}
        {call.capturing && <p className="text-muted-foreground text-xs">{t('mb58bf9671da2')}</p>}
        {(error || call.error) && (
          <p role="alert" className="text-destructive">
            {error || call.error}
          </p>
        )}
        {busy && <p role="status">{t('mbccadba05b3a')}</p>}
      </section>
      {phase !== 'setup' && (
        <label className="mt-6 block text-sm">
          {t('m95186ea9928f')}
          <textarea
            className="study-field min-h-44"
            readOnly
            value={text}
            placeholder={t('mbb18c1d2821a')}
          />
        </label>
      )}
      <div className="mt-8 space-y-5">
        {Object.entries(transcripts)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([key, transcript]) => {
            const index = Number(key);
            const result = reviews[index];
            return (
              <section key={key} className="bg-card space-y-3 rounded-xl border p-5">
                <h2 className="font-semibold">
                  {translateStatic(t, AGILITY_ROUNDS[index].label)} {t('m6674cbf4c796')}
                </h2>
                <details>
                  <summary>{t('m313284dfe84e')}</summary>
                  <p className="mt-3 whitespace-pre-wrap">{transcript}</p>
                </details>
                {result ? (
                  <>
                    <p>{result.feedback}</p>
                    {result.corrections.map((correction, i) => (
                      <article key={i} className="space-y-2 border-t pt-3">
                        <p>
                          {t('m1df012ff08d1')} {correction.original}
                        </p>
                        <p>
                          {t('m5f7e9ab243eb')}
                          <strong>{correction.corrected}</strong>
                        </p>
                        <p>{correction.explanation}</p>
                        <p className="text-sm">
                          {t('m292c34a12554')} {correction.pattern}
                        </p>
                      </article>
                    ))}
                    {result.corrections.length === 0 && <p>{t('maa77262d7ad2')}</p>}
                    <p className="text-muted-foreground text-xs">
                      {t('mb0322df915f0')} {result.reused ? t('m81ee3ba51d0c') : ''}{' '}
                      {t('m6394073528d0')}
                    </p>
                  </>
                ) : (
                  <button
                    className="study-text-link"
                    disabled={busy}
                    onClick={() => void retryReview(index)}
                  >
                    {t('m897f85861b6a')}
                  </button>
                )}
              </section>
            );
          })}
      </div>
      {phase === 'done' && !busy && (
        <Link href="/call?practice=fluency&start=audit" className="study-button mt-8">
          {t('m6eae6b9fd5d6')}
        </Link>
      )}
      <p className="text-muted-foreground mt-6 text-xs">{t('m14280705a4b7')}</p>
    </main>
  );
}

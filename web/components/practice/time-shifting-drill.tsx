'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ContinueCallLink } from '@/components/practice/continue-call-link';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
import { useDrillCall } from '@/hooks/use-drill-call';
import { useTimerAlarm } from '@/hooks/use-timer-alarm';
import { translateStatic } from '@/i18n/static-text';
import { NATIVE_LANGUAGES, type NativeLanguage } from '@/lib/practice-options';
import { DRILL_STEPS, type DrillCorrection } from '@/lib/time-shifting';
import styles from './time-shifting-drill.module.css';

type Review = {
  text: string;
  corrections: DrillCorrection[];
  feedback: string;
  saved: boolean;
  reused?: boolean;
};
export function TimeShiftingDrill({ agentName }: { agentName?: string }) {
  const t = useTranslations('ui');

  const call = useDrillCall();
  const [step, setStep] = useState(0);
  const [routine, setRoutine] = useState('');
  const language = useLocale() as NativeLanguage;
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState<number>(60);
  const [running, setRunning] = useState(false);
  useTimerAlarm({ key: `temporal:${step}`, remaining, running, active: call.capturing });
  const recording = call.capturing;
  const [captured, setCaptured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const stopAt = useRef(0);
  const startAttempt = useRef(0);
  useEffect(() => {
    if (!running) return;
    stopAt.current = Date.now() + remaining * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((stopAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (!left) {
        setRunning(false);
        // Time expiry never cuts off speech. The learner explicitly finishes.
      }
    }, 250);
    return () => clearInterval(id);
    // remaining is intentionally captured only on start/resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const result = reviews[step];
  useEffect(() => {
    if (recording) setText(call.text);
  }, [call.text, recording]);
  useEffect(() => {
    if (!call.connected) setRunning(false);
  }, [call.connected]);
  async function record(index = step) {
    if (!routine.trim() || starting || busy || recording) return;
    const attempt = ++startAttempt.current;
    setStarting(true);
    setError('');
    try {
      if (!(await call.start(language, agentName)) || attempt !== startAttempt.current) return;
      setText('');
      setReviews((previous) => {
        const next = { ...previous };
        delete next[index];
        return next;
      });
      setCaptured(false);
      setRemaining(DRILL_STEPS[index].seconds);
      setRunning(true);
    } catch (e) {
      if (attempt === startAttempt.current) {
        setError(e instanceof Error ? e.message : t('m926a7d492154'));
        setRunning(false);
      }
    } finally {
      if (attempt === startAttempt.current) setStarting(false);
    }
  }
  async function cancelStart() {
    ++startAttempt.current;
    await call.disconnect();
    setStarting(false);
  }
  async function review() {
    setBusy(true);
    setError('');
    setRunning(false);
    try {
      const transcript = recording ? await call.finish() : text;
      setText(transcript);
      setCaptured(true);
      const form = new FormData();
      form.set('step', String(step));
      form.set('routine', routine);
      form.set('language', language);
      form.set('previousPresent', step < 3 ? (reviews[0]?.text ?? '') : '');
      form.set('text', transcript);
      const response = await fetch('/api/time-shifting', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('m0dca685a0449'));
      setReviews((prev) => ({ ...prev, [step]: data }));
      setText(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mdf0ac4a97623'));
    } finally {
      setBusy(false);
    }
  }
  function next() {
    const index = step + 1;
    setStep(index);
    setText('');
    setCaptured(false);
    setRemaining(DRILL_STEPS[index].seconds);
    setRunning(false);
    if (index === 3) {
      // The final round deliberately asks for another routine.
      setRoutine('');
    } else {
      void record(index);
    }
  }
  const locked = starting || busy || call.pending;
  const preparing = !recording && !captured && !result && !text;
  const canEditRoutine = preparing && (step === 0 || step === 3);
  return (
    <main className="drill-workspace">
      <Link className="study-text-link text-sm" href="/home">
        {t('m23e939f389fb')}
      </Link>
      <header className={styles.header}>
        <p className="text-muted-foreground mb-3 text-sm">{t('m27b959bccebb')}</p>
        <h1 className={`study-title ${styles.title}`}>{t('m0e95d12311e2')}</h1>
        <p className="text-muted-foreground mt-3 leading-7">{t('md91a4b340339')}</p>
      </header>
      <div className="drill-layout">
        <FluencyBlocks current={0} disabled={recording || locked} />
        <aside className={styles.steps}>
          <h2 className="mb-4 font-semibold">{t('mdb4af942e884')}</h2>
          <ol className="drill-step-list">
            {DRILL_STEPS.map((item, index) => (
              <li
                key={translateStatic(t, item.label)}
                aria-current={step === index ? 'step' : undefined}
              >
                <span className="text-muted-foreground mb-1 block text-xs">
                  {t('m2b88f694472f')} {index + 1} · {item.seconds / 60} {t('m1f6fa6f69d18')}{' '}
                  {reviews[index] ? t('m2b68200c2875') : ''}
                </span>
                {translateStatic(t, item.label)}
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-5 text-sm leading-6">{t('m94ea9f0579b4')}</p>
        </aside>
        <div className={`drill-content ${styles.content}`} aria-busy={locked}>
          {canEditRoutine ? (
            <form
              className={styles.setup}
              onSubmit={(event) => {
                event.preventDefault();
                void record();
              }}
            >
              <h2 className="text-2xl font-semibold">
                {step === 3 ? t('m0d9a2d586e86') : t('ma1122f526306')}
              </h2>
              <p className="text-muted-foreground text-sm leading-6">
                {step === 3 ? t('mec3a46ae3fbe') : t('m315e3b13449d')}
              </p>
              <label className="block text-sm font-medium">
                {step === 3 ? t('m120496afc859') : t('m7221298cbd7c')}
                <input
                  className="study-field"
                  placeholder={t('m00816d72e1d3')}
                  maxLength={500}
                  required
                  value={routine}
                  disabled={locked}
                  onChange={(event) => setRoutine(event.target.value)}
                />
              </label>
              <p className="text-muted-foreground text-sm">
                {t('medca6f0ab6be')} {translateStatic(t, NATIVE_LANGUAGES[language])}.{' '}
                <Link href="/profile" className="study-text-link">
                  {t('m1096db3ab260')}
                </Link>
              </p>
              <div className={styles.preview}>
                <span className="font-medium">{translateStatic(t, DRILL_STEPS[step].label)}</span>
                <span>
                  {DRILL_STEPS[step].seconds / 60} {t('m16d3e5e66342')} {step + 1}{' '}
                  {t('m33a028fbdd8d')}
                </span>
              </div>
              <button className="study-button" type="submit" disabled={locked || !routine.trim()}>
                {starting
                  ? t('m0777953518d0')
                  : step === 0
                    ? t('m56c15725db8f')
                    : t('m703627b32a9f')}
              </button>
              <p className="text-muted-foreground text-xs leading-6">{t('m3b10e9877c1a')}</p>
            </form>
          ) : (
            <>
              <div className={styles.routine}>
                <span className="text-muted-foreground text-xs">
                  {t('m63a9c1ff71e1')} {translateStatic(t, NATIVE_LANGUAGES[language])}
                </span>
                <p>{routine}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-sm">
                  {t('m2b88f694472f')} {step + 1} {t('m33a028fbdd8d')}
                </p>
                <h2 className="text-2xl font-semibold">
                  {translateStatic(t, DRILL_STEPS[step].label)}
                </h2>
                <p className="text-muted-foreground mt-3 leading-7">
                  {translateStatic(t, DRILL_STEPS[step].instruction)}
                </p>
              </div>
              <div className="drill-clock">
                <p
                  className="font-mono text-5xl tracking-tight"
                  role="timer"
                  aria-label={t('ma778f0bbf3ec')}
                >
                  {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                </p>
                <span className="text-muted-foreground text-sm" role="status">
                  {busy
                    ? t('md68fd25f9fbd')
                    : recording
                      ? remaining === 0
                        ? t('m9b24e4af43cb')
                        : running
                          ? t('m61e824a26bda')
                          : t('mbb435233dbf5')
                      : result
                        ? t('m37a1c0f65218')
                        : t('m17acca10496e')}
                </span>
              </div>
              {recording ? (
                <div className={styles.actions}>
                  <button className="study-button" disabled={locked} onClick={() => void review()}>
                    {busy ? t('m0a88e7af9b2a') : t('mb5a3bad88bcb')}
                  </button>
                  {remaining > 0 && (
                    <button
                      className="study-text-link text-sm"
                      disabled={locked}
                      onClick={() => setRunning((value) => !value)}
                    >
                      {running ? t('ma0dfa43d802c') : t('m61befb8ef072')}
                    </button>
                  )}
                </div>
              ) : (
                !result && (
                  <button
                    className="study-button"
                    disabled={locked || !routine.trim()}
                    onClick={() => void (captured ? review() : record())}
                  >
                    {busy
                      ? t('m82f6b2998fce')
                      : starting
                        ? t('m0777953518d0')
                        : captured
                          ? t('mf77c7c5a0c26')
                          : t('m1abf35cc48e5')}
                  </button>
                )
              )}
              {recording && (
                <p className="text-muted-foreground text-xs leading-6">{t('m7875ba6f892c')}</p>
              )}
              {(recording || captured || text) && (
                <label className="block text-sm font-medium">
                  {t('ma5309079cad8')}
                  <textarea
                    className="study-field min-h-44 resize-y leading-7"
                    placeholder={t('m6d491947f405')}
                    value={text}
                    maxLength={8000}
                    readOnly
                  />
                </label>
              )}
              {result && (
                <section className="drill-review space-y-4" aria-live="polite">
                  <h2 className="text-xl font-semibold">{t('mb267802a7357')}</h2>
                  {result.reused && <p>{t('mfb07d63ecac6')}</p>}
                  <p>{result.feedback}</p>
                  {!result.corrections.length && <p>{t('mf9be6cf05534')}</p>}
                  {result.corrections.map((c, i) => (
                    <article key={i} className="drill-correction space-y-3">
                      <p>
                        <span className="text-muted-foreground block text-xs">
                          {t('mbc394d021e8b')}
                        </span>
                        {c.original}
                      </p>
                      <p>
                        <span className="text-muted-foreground block text-xs">
                          {t('m7a57629d6e40')}
                        </span>
                        <strong>{c.corrected}</strong>
                      </p>
                      <p className="text-sm leading-6">{c.explanation}</p>
                      <p className="text-sm">
                        {t('m292c34a12554')} {c.pattern}
                      </p>
                    </article>
                  ))}
                  <p>{t('mbb7448b5982e')}</p>
                </section>
              )}
              {result && step < 3 ? (
                <button className="study-button" disabled={locked || recording} onClick={next}>
                  {step === 2
                    ? t('mfbc2490d8f2c')
                    : t('m20d05cf44d7a', { v0: translateStatic(t, DRILL_STEPS[step + 1].label) })}
                </button>
              ) : (
                result && !locked && !recording && <ContinueCallLink />
              )}
              {(captured || result) && !recording && (
                <button
                  className="study-text-link text-sm"
                  disabled={locked}
                  onClick={() => void record()}
                >
                  {t('mfa963593b5f7')}
                </button>
              )}
            </>
          )}
          {starting && (
            <div className={styles.connection} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              <span>{t('mf2c963732b73')}</span>
              <button className="study-text-link text-sm" onClick={() => void cancelStart()}>
                {t('mbb9dbb406dcb')}
              </button>
            </div>
          )}
          {(call.error || error) && !starting && (
            <p role="alert" className="text-destructive text-sm">
              {call.error || error}
            </p>
          )}
          {call.connected && !recording && !locked && (
            <button
              className="study-text-link text-muted-foreground text-xs"
              onClick={() => void call.disconnect()}
            >
              {t('m45d50dfd435f')}
            </button>
          )}
          <p className="text-muted-foreground border-t pt-5 text-xs leading-6">
            {t('m5bb586bd6ec7')}
          </p>
        </div>
      </div>
    </main>
  );
}

'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useDataChannel, useSessionContext } from '@livekit/components-react';
import { CallWorkspace } from '@/components/app/call-workspace';
import { CorrectionsHistory } from '@/components/app/corrections-history';
import { PracticeRoadmap, type RouteStep } from '@/components/app/practice-roadmap';
import { useTimerAlarm } from '@/hooks/use-timer-alarm';
import { translateStatic } from '@/i18n/static-text';
import { type JournalEntry, correctionDay, mergeJournalEntries } from '@/lib/correction-history';
import { PRACTICE_GUIDANCE } from '@/lib/practice-guidance';
import type { PracticeMode } from '@/lib/practice-options';

type Timer = {
  step: string;
  remaining_seconds: number;
  elapsed_seconds: number;
  running: boolean;
  started: boolean;
  finished: boolean;
  step_index: number;
  step_count: number;
  step_duration_seconds: number;
  block: string;
  feedback_ready?: boolean;
  feedback_summary?: string;
  route?: RouteStep[];
  quota?: {
    state: string;
    wait_seconds?: number;
    last_input_tokens?: number;
    last_output_tokens?: number;
  };
};

export function PracticePanel({ mode, children }: { mode: PracticeMode; children: ReactNode }) {
  const t = useTranslations('ui');

  const { isConnected, end } = useSessionContext();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  async function openInputBlock(block: 'input' | 'agility' = 'input') {
    if (leaving) return;
    setLeaving(true);
    setControlError('');
    try {
      await end();
      router.push(`/practice-b/${block}`);
    } catch {
      setLeaving(false);
      setControlError(t('maae59a49086a'));
    }
  }
  const [timer, setTimer] = useState<Timer | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [saved, setSaved] = useState(true);
  const [queued, setQueued] = useState(false);
  const [material, setMaterial] = useState<{ url: string; title: string } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [historyDay, setHistoryDay] = useState(() => correctionDay(new Date().toISOString()));
  const [historyDays, setHistoryDays] = useState<string[]>([]);
  const [controlEvidence, setControlEvidence] = useState('');
  const [controlError, setControlError] = useState('');
  const { send: sendControl, isSending } = useDataChannel('practice-control');
  useEffect(() => {
    setControlEvidence('');
  }, [timer?.step_index]);
  async function control(action: string, targetStep?: number) {
    setControlError('');
    try {
      await sendControl(
        new TextEncoder().encode(
          JSON.stringify({
            action,
            target_step: targetStep,
            request_id: crypto.randomUUID(),
            step_index: timer?.step_index,
            evidence: controlEvidence.trim(),
          })
        ),
        { reliable: true }
      );
    } catch {
      setControlError(t('m847b1e90b5c0'));
    }
  }
  useDataChannel('practice', (message) => {
    try {
      setTimer(JSON.parse(new TextDecoder().decode(message.payload)));
      setReceivedAt(Date.now());
    } catch {
      /* Ignore malformed data. */
    }
  });
  useDataChannel('practice-journal', (message) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(message.payload));
      setEntries((previous) => mergeJournalEntries(previous, [data.entry]));
      setSaved(data.saved);
      setQueued(Boolean(data.queued));
    } catch {
      /* Ignore malformed data. */
    }
  });
  useDataChannel('practice-material', (message) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(message.payload));
      const url = new URL(data.url);
      if (url.protocol === 'https:') setMaterial(data);
    } catch {
      /* Ignore malformed links. */
    }
  });
  useEffect(() => {
    if (!isConnected) {
      setTimer(null);
      setMaterial(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    fetch(`/api/practice-journal?day=${encodeURIComponent(historyDay)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !cancelled) {
          setEntries((current) => mergeJournalEntries(data.entries ?? [], current));
          setHistoryAvailable(Boolean(data.available));
          setHasMore(Boolean(data.hasMore));
          setHistoryDays(data.days ?? []);
        } else if (!cancelled) setHistoryAvailable(false);
      })
      .catch(() => {
        if (!cancelled) setHistoryAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isConnected, historyDay]);
  const nextStep = timer?.route?.[(timer?.step_index ?? 0) + 1];
  const nextBlock = nextStep && nextStep.block !== timer?.block;
  const externalInput =
    mode === 'fluency' && timer !== null && timer.step_index >= 5 && timer.step_index <= 14;
  const independentBlock = timer && timer.step_index >= 9 ? 4 : 3;
  const inputNext = mode === 'fluency' && timer?.step_index === 4;
  const remaining = timer
    ? Math.max(
        0,
        timer.remaining_seconds -
          (timer.running ? Math.floor(Math.max(0, now - receivedAt) / 1000) : 0)
      )
    : 0;
  const alarm = useTimerAlarm({
    key: `${mode}:${timer?.step_index ?? -1}`,
    remaining,
    running: Boolean(timer?.running),
    active: Boolean(isConnected && timer?.started && !timer.finished),
  });
  if (!isConnected) return null;
  return (
    <CallWorkspace
      session={children}
      navigation={
        timer?.route && (
          <PracticeRoadmap
            steps={timer.route}
            current={timer.step_index}
            finished={timer.finished}
            disabled={isSending}
            onSelectBlock={(index) => {
              if (!window.confirm(t('m6d5c061fb903'))) return;
              if (index === 5 && mode === 'fluency') void openInputBlock();
              else if (index === 9 && mode === 'fluency') void openInputBlock('agility');
              else void control('select_block', index);
            }}
          />
        )
      }
      controls={
        <aside
          aria-label={t('m96d78c4c873e')}
          className="practice-console call-practice-controls bg-card border-t p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t('mc9a836daa8e6')}</p>
            <span className="bg-secondary rounded-full px-2 py-1 text-xs">
              {timer?.finished
                ? t('m636c7b850c4d')
                : !timer?.started
                  ? t('m12beb07b0d96')
                  : timer.running
                    ? t('m75f1f75e3337')
                    : t('mc28d816de982')}
            </span>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">{t('m45ee963fa02f')}</p>
          <p className="text-muted-foreground mt-2 text-xs">
            {(timer?.block ? translateStatic(t, timer.block) : undefined) ??
              (mode === 'fluency'
                ? t('me0965d754237')
                : mode === 'diagnostic'
                  ? t('me695eb16e81f')
                  : t('ma9ca1936dbd4'))}
            {' · '}
            {t('m2b88f694472f')} {(timer?.step_index ?? 0) + 1} {t('m959a45d44e6f')}{' '}
            {timer?.step_count ?? (mode === 'fluency' ? 16 : mode === 'diagnostic' ? 7 : 13)}
          </p>
          <p className="mt-1 text-base font-semibold" aria-live="polite">
            {(timer?.step ? translateStatic(t, timer.step) : undefined) ??
              (mode === 'fluency'
                ? t('mb8b2113bcd5f')
                : mode === 'diagnostic'
                  ? t('m84a1971a68cd')
                  : t('m12beb07b0d96'))}
          </p>
          {externalInput && (
            <div className="mt-4 space-y-3 rounded-lg border p-3">
              <p className="text-sm">
                {t('m618b41a3b406')} {independentBlock} {t('mbb6262a8ae68')}
              </p>
              <button
                className="study-button"
                disabled={leaving}
                onClick={() => void openInputBlock(independentBlock === 4 ? 'agility' : 'input')}
              >
                {leaving ? t('m187caf348216') : t('m934f6c4033b0', { v0: independentBlock })}
              </button>
              {controlError && <p role="alert">{controlError}</p>}
            </div>
          )}
          {timer && !timer.finished && !externalInput && (
            <div className="my-3 space-y-2 rounded border p-2">
              <p className="text-sm">
                {translateStatic(t, PRACTICE_GUIDANCE[mode][timer.step_index])}
              </p>
              <p className="text-xs">{t('mc08262635334')}</p>
              <label htmlFor="practice-evidence" className="block text-xs font-medium">
                {timer.started ? t('ma4e33189edbc') : t('mee1e99421c80')}
              </label>
              <input
                id="practice-evidence"
                aria-label={t('m868894b7dfa8')}
                className="w-full rounded border p-2 text-sm"
                maxLength={600}
                value={controlEvidence}
                onChange={(e) => setControlEvidence(e.target.value)}
                placeholder={timer.started ? t('mb6b11217d541') : t('m439ed80063fd')}
              />
              <div className="flex flex-wrap gap-2 text-xs">
                {!timer.started ? (
                  <button
                    disabled={isSending || !controlEvidence.trim()}
                    onClick={() => void control('start')}
                  >
                    {t('m6dfbcc6fb285')}
                  </button>
                ) : (
                  <>
                    <button
                      disabled={isSending}
                      onClick={() => void control(timer.running ? 'pause' : 'resume')}
                    >
                      {timer.running ? t('mcd25ee5b1db8') : t('m63e2bbaf1c92')}
                    </button>
                    <button
                      className="bg-primary text-primary-foreground rounded-lg px-3 py-2 font-semibold disabled:opacity-50"
                      disabled={
                        isSending ||
                        leaving ||
                        (inputNext ? !timer.feedback_ready : !controlEvidence.trim())
                      }
                      onClick={() => (inputNext ? void openInputBlock() : void control('next'))}
                    >
                      {inputNext
                        ? t('m519866c7e6ef')
                        : nextStep
                          ? nextBlock
                            ? t('m4fb94fec1e63')
                            : t('m72a0f0ddfef4')
                          : t('m3df3c5e1c879')}
                    </button>
                  </>
                )}
                <button disabled={isSending} onClick={() => void control('finish')}>
                  {t('m925f8d47204f')}
                </button>
              </div>
              {timer.started && nextStep && (
                <p className="text-muted-foreground text-xs">
                  {t('m8d70f61bbb1f')} {nextBlock ? `${translateStatic(t, nextStep.block)} · ` : ''}
                  {translateStatic(t, nextStep.label)}
                </p>
              )}
              {controlError && <p role="alert">{controlError}</p>}
            </div>
          )}
          <p className="mt-2 font-mono text-4xl font-bold tabular-nums" aria-live="off">
            {timer?.started
              ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
              : mode === 'fluency'
                ? '01:00'
                : mode === 'diagnostic'
                  ? '04:00'
                  : '05:00'}
          </p>
          {inputNext && timer?.started && (
            <p role="status" className="mt-3 text-sm leading-6">
              {timer.feedback_ready
                ? timer.feedback_summary || t('monologueFeedbackReady')
                : t('monologueFeedbackPending')}
            </p>
          )}
          <p className="text-muted-foreground mt-1 text-xs">
            {!timer
              ? t('m17eab700c2fc')
              : !timer.started
                ? t('m8b55c41443ae')
                : timer.finished
                  ? t('m752e93a530b4')
                  : remaining === 0
                    ? t('m11cb41d6ce88')
                    : t('m01d065d25db8')}
          </p>
          {timer?.quota && timer.quota.state !== 'ready' && (
            <p role="status" className="mt-2 rounded-md bg-amber-500/15 p-2 text-sm">
              {timer.quota.state === 'waiting'
                ? t('mae1b342213a6', { v0: timer.quota.wait_seconds ?? 0 })
                : timer.quota.state === 'input_too_long'
                  ? t('m6acbea1168fa')
                  : timer.quota.state === 'daily_limit'
                    ? t('mc073e71b4768')
                    : t('mb1a061b9d06d')}
            </p>
          )}
          <progress
            className="mt-2 h-2 w-full"
            aria-label={t('m1d73f1a44dc3')}
            max={timer?.step_duration_seconds ?? 300}
            value={timer?.started ? (timer.step_duration_seconds ?? 300) - remaining : 0}
          />
          <p className="text-muted-foreground mt-1 text-xs">{t('m074d1e936ce0')}</p>
          {!alarm.ready && (
            <button className="study-text-link mt-2 text-xs" onClick={() => void alarm.enable()}>
              {t('timerEnableSound')}
            </button>
          )}
          {material && (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm underline"
            >
              {material.title}
            </a>
          )}
        </aside>
      }
      corrections={
        <CorrectionsHistory
          entries={entries}
          loading={historyLoading}
          available={saved && historyAvailable}
          queued={queued}
          hasMore={hasMore}
          selectedDay={historyDay}
          days={historyDays}
          onSelectDay={setHistoryDay}
        />
      }
    />
  );
}

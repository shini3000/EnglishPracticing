'use client';

import { useEffect, useState } from 'react';
import { useDataChannel, useSessionContext } from '@livekit/components-react';
import { CorrectionCard } from '@/components/app/correction-card';
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
  quota?: {
    state: string;
    wait_seconds?: number;
    last_input_tokens?: number;
    last_output_tokens?: number;
  };
};
type JournalEntry = { kind: string; date: string; [key: string]: unknown };

export function PracticePanel({ mode }: { mode: PracticeMode }) {
  const { isConnected } = useSessionContext();
  const [timer, setTimer] = useState<Timer | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [saved, setSaved] = useState(true);
  const [queued, setQueued] = useState(false);
  const [material, setMaterial] = useState<{ url: string; title: string } | null>(null);
  const [correctionVisible, setCorrectionVisible] = useState(true);
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
      setEntries((previous) => [...previous, data.entry]);
      if (data.entry?.kind === 'correction') setCorrectionVisible(true);
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
      setEntries([]);
      setMaterial(null);
      return;
    }
    let cancelled = false;
    fetch('/api/practice-journal')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !cancelled) {
          setEntries((current) => [...data.entries, ...current]);
          setSaved(data.available);
        }
      })
      .catch(() => {
        if (!cancelled) setSaved(false);
      });
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isConnected]);
  if (!isConnected) return null;
  const latestCorrection = [...entries].reverse().find((entry) => entry.kind === 'correction');
  const remaining = timer
    ? Math.max(
        0,
        timer.remaining_seconds -
          (timer.running ? Math.floor(Math.max(0, now - receivedAt) / 1000) : 0)
      )
    : 0;
  return (
    <aside
      aria-label="Cronómetro y paso de la práctica"
      className="bg-background fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 left-3 z-[100] max-h-[70vh] overflow-auto rounded-xl border-2 border-emerald-500 p-4 shadow-xl sm:left-auto sm:w-96"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide uppercase">Cronómetro de práctica</p>
        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs">
          {timer?.finished
            ? 'Finalizada'
            : !timer?.started
              ? 'Preparación'
              : timer.running
                ? 'En curso'
                : 'En pausa'}
        </span>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        {timer?.block ??
          (mode === 'fluency'
            ? 'Bloque 1 · Gimnasia temporal'
            : mode === 'diagnostic'
              ? 'Diagnóstico'
              : 'Bloque 1 · Recuperación y diagnóstico')}
        {' · '}Paso {(timer?.step_index ?? 0) + 1} de{' '}
        {timer?.step_count ?? (mode === 'fluency' ? 16 : mode === 'diagnostic' ? 7 : 13)}
      </p>
      <p className="mt-1 text-base font-semibold" aria-live="polite">
        {timer?.step ??
          (mode === 'fluency'
            ? 'Rutina en presente'
            : mode === 'diagnostic'
              ? 'Presentación y presente'
              : 'Preparación')}
      </p>
      <p className="mt-2 font-mono text-4xl font-bold tabular-nums" aria-live="off">
        {timer?.started
          ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
          : mode === 'fluency'
            ? '01:00'
            : mode === 'diagnostic'
              ? '04:00'
              : '05:00'}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {!timer
          ? 'Conectando con el cronómetro del tutor…'
          : !timer.started
            ? 'El tiempo comienza al confirmar el tema.'
            : timer.finished
              ? 'Práctica terminada.'
              : remaining === 0
                ? 'Tiempo cumplido: termina tu respuesta antes de cambiar de paso.'
                : 'Tiempo restante del paso actual'}
      </p>
      {timer?.quota && timer.quota.state !== 'ready' && (
        <p role="status" className="mt-2 rounded-md bg-amber-500/15 p-2 text-sm">
          {timer.quota.state === 'waiting'
            ? `Esperando cuota de IA · ${timer.quota.wait_seconds ?? 0} s. Tu práctica se conserva.`
            : timer.quota.state === 'input_too_long'
              ? 'Respuesta extensa: el tutor te pedirá trabajarla en partes.'
              : timer.quota.state === 'daily_limit'
                ? 'Cuota diaria local alcanzada. Práctica en pausa; conserva y repasa tus correcciones.'
                : 'Cuota de IA temporalmente limitada. Tu avance se conserva.'}
        </p>
      )}
      <progress
        className="mt-2 h-2 w-full"
        aria-label="Avance del paso"
        max={timer?.step_duration_seconds ?? 300}
        value={timer?.started ? (timer.step_duration_seconds ?? 300) - remaining : 0}
      />
      <p className="text-muted-foreground mt-1 text-xs">
        Pide al tutor pausar, continuar o terminar.
      </p>
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
      {latestCorrection && (
        <div aria-live="polite">
          <button
            type="button"
            className="mt-3 text-sm underline"
            onClick={() => setCorrectionVisible((visible) => !visible)}
          >
            {correctionVisible
              ? 'Ocultar corrección para practicar sin leer'
              : 'Mostrar última corrección'}
          </button>
          {correctionVisible && <CorrectionCard entry={latestCorrection} />}
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm">
          Registro acumulativo ({entries.length})
        </summary>
        {!saved && (
          <p className="mt-2 text-xs">
            {queued
              ? 'Evidencia en cola local: se sincronizará cuando la base vuelva a estar disponible en este equipo.'
              : 'Guardado no disponible: conserva estas notas antes de salir.'}
          </p>
        )}
        {entries.map((entry, index) => (
          <div key={index} className="mt-2 border-t pt-2 text-xs">
            <p className="font-medium">
              {entry.date} · {entry.kind}
            </p>
            {entry.kind === 'correction' ? (
              <CorrectionCard entry={entry} />
            ) : (
              <pre className="mt-1 font-sans break-words whitespace-pre-wrap">
                {JSON.stringify(entry, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </details>
    </aside>
  );
}

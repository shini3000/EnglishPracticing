'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
import { useDrillCall } from '@/hooks/use-drill-call';
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
  const call = useDrillCall('agility');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState<NativeLanguage>('es');
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState('');
  const [transcripts, setTranscripts] = useState<Record<number, string>>({});
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stopAt = useRef(0);
  useEffect(() => {
    const stored = localStorage.getItem('native-language');
    if (stored && Object.hasOwn(NATIVE_LANGUAGES, stored)) setLanguage(stored as NativeLanguage);
  }, []);
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
    if (!response.ok) throw new Error(result.error || 'No se pudo revisar esta ronda.');
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
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la transcripción.');
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
      setError(e instanceof Error ? e.message : 'Conserva tu texto y vuelve a intentarlo.');
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
      setError(e instanceof Error ? e.message : 'No se pudo revisar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/practice-b" className="study-text-link text-sm">
        Volver a los bloques
      </Link>
      <FluencyBlocks current={3} disabled={call.capturing || busy || call.pending} />
      <p className="text-muted-foreground mt-8 text-sm">
        Práctica B · Bloque 4 · Agilidad y síntesis
      </p>
      <h1 className="study-title mt-3">Tus ideas, en menos tiempo.</h1>
      <p className="text-muted-foreground mt-5 leading-7">
        Elige una pregunta abierta y cuenta las mismas ideas en 4, 3 y 2 minutos. Entre rondas,
        respira 30 segundos. Solo se transcribe tu voz: no hay conversación ni voz del tutor. Las
        correcciones aparecen por escrito.
      </p>
      <label className="mt-6 block text-sm">
        Pregunta abierta para las tres rondas
        <input
          className="study-field"
          value={topic}
          maxLength={500}
          disabled={phase !== 'setup'}
          placeholder="Por ejemplo: ¿Qué experiencia cambió tu manera de pensar?"
          onChange={(event) => setTopic(event.target.value)}
        />
      </label>
      <label className="mt-4 block text-sm">
        Idioma de las correcciones
        <select
          className="study-field"
          value={language}
          disabled={call.connected || busy}
          onChange={(event) => {
            setLanguage(event.target.value as NativeLanguage);
            localStorage.setItem('native-language', event.target.value);
          }}
        >
          {Object.entries(NATIVE_LANGUAGES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <section
        className="bg-card mt-6 space-y-4 rounded-2xl border p-6"
        aria-label="Cronómetro 4–3–2"
      >
        {(phase === 'ready' || phase === 'speaking') && (
          <p className="text-sm leading-6">
            {
              [
                'Explora la pregunta libremente durante cuatro minutos. Desarrolla tus ideas sin leer un guion.',
                'Repite exactamente las mismas ideas en tres minutos, eliminando divagaciones y conectando mejor las frases.',
                'Expresa el núcleo del mismo argumento en dos minutos, con concisión y una cadencia cómoda.',
              ][round]
            }
          </p>
        )}
        <h2 className="text-xl font-semibold">
          {phase === 'setup'
            ? 'Preparación y palabras clave · 5 min'
            : phase === 'rest'
              ? 'Descanso · 30 segundos'
              : phase === 'done'
                ? 'Rondas terminadas'
                : AGILITY_ROUNDS[round].label}
        </h2>
        <p role="timer" aria-label="Tiempo restante" className="font-mono text-5xl tabular-nums">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </p>
        <p role="status" className="text-muted-foreground text-sm">
          {phase === 'rest'
            ? 'Micrófono cerrado. Respira; no prepares ideas distintas.'
            : phase === 'setup'
              ? 'Prepara unas pocas palabras clave, no un guion. El tiempo de preparación completa los 15 minutos del bloque.'
              : call.capturing
                ? 'Micrófono en inglés. Al llegar a cero, termina tu idea y pulsa «Terminé la ronda».'
                : 'El micrófono permanece cerrado hasta que empieces una ronda.'}
        </p>
        {(phase === 'setup' || phase === 'rest' || phase === 'speaking') && (
          <button
            className="study-text-link"
            disabled={remaining === 0}
            onClick={() => setRunning((value) => !value)}
          >
            {running ? 'Pausar cronómetro' : 'Iniciar / continuar cronómetro'}
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
            Preparado para la primera ronda
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
            Preparar siguiente ronda
          </button>
        )}
        {phase === 'ready' &&
          (!call.connected ? (
            <button
              className="study-button"
              disabled={call.pending}
              onClick={() => void call.connect(language, agentName)}
            >
              Conectar solo transcripción
            </button>
          ) : (
            <button
              className="study-button"
              disabled={!call.ready || call.pending || busy}
              onClick={() => void startRound()}
            >
              {call.ready ? 'Empezar a hablar' : 'Esperando al agente de transcripción…'}
            </button>
          ))}
        {phase === 'speaking' && call.capturing && (
          <button
            className="study-button"
            disabled={busy || call.pending}
            onClick={() => void finishRound()}
          >
            Terminé la ronda · cerrar micrófono y revisar
          </button>
        )}
        {phase === 'speaking' && !call.capturing && (
          <p>
            La captura se interrumpió. Conserva el texto y vuelve a preparar esta ronda.{' '}
            <button
              className="study-text-link"
              disabled={busy || call.pending}
              onClick={() => setPhase('ready')}
            >
              Repetir ronda
            </button>
          </p>
        )}
        {call.connected && (
          <button
            className="study-text-link"
            disabled={busy || call.pending}
            onClick={() => void call.disconnect()}
          >
            Cerrar conexión de transcripción
          </button>
        )}
        {call.capturing && (
          <p className="text-muted-foreground text-xs">
            Pausar el cronómetro no cierra el micrófono.
          </p>
        )}
        {(error || call.error) && (
          <p role="alert" className="text-destructive">
            {error || call.error}
          </p>
        )}
        {busy && <p role="status">Cerrando la transcripción o preparando la revisión escrita…</p>}
      </section>
      <label className="mt-6 block text-sm">
        Transcripción de la ronda
        <textarea
          className="study-field min-h-44"
          readOnly
          value={text}
          placeholder="Tu respuesta aparecerá aquí al hablar en inglés."
        />
      </label>
      <div className="mt-8 space-y-5">
        {Object.entries(transcripts).map(([key, transcript]) => {
          const index = Number(key);
          const result = reviews[index];
          return (
            <section key={key} className="bg-card space-y-3 rounded-xl border p-5">
              <h2 className="font-semibold">{AGILITY_ROUNDS[index].label} · Revisión escrita</h2>
              <details>
                <summary>Ver transcripción de esta ronda</summary>
                <p className="mt-3 whitespace-pre-wrap">{transcript}</p>
              </details>
              {result ? (
                <>
                  <p>{result.feedback}</p>
                  {result.corrections.map((correction, i) => (
                    <article key={i} className="space-y-2 border-t pt-3">
                      <p>Tu frase: {correction.original}</p>
                      <p>
                        Corrección: <strong>{correction.corrected}</strong>
                      </p>
                      <p>{correction.explanation}</p>
                      <p className="text-sm">Estructura: {correction.pattern}</p>
                    </article>
                  ))}
                  {result.corrections.length === 0 && (
                    <p>No se detectaron errores claros. Esto no certifica dominio.</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Guardado como ensayo del bloque 4
                    {result.reused ? ' · revisión anterior reutilizada' : ''}. La transcripción
                    puede contener errores de reconocimiento.
                  </p>
                </>
              ) : (
                <button
                  className="study-text-link"
                  disabled={busy}
                  onClick={() => void retryReview(index)}
                >
                  Reintentar revisión escrita de esta ronda
                </button>
              )}
            </section>
          );
        })}
      </div>
      {phase === 'done' && !busy && (
        <Link href="/call?practice=fluency&start=audit" className="study-button mt-8">
          Preparar el bloque 5 con el tutor
        </Link>
      )}
      <p className="text-muted-foreground mt-6 text-xs">
        La transcripción usa LiveKit y Groq, como el bloque 1. La corrección usa el modelo
        configurado en el servidor web; no se genera audio ni se evalúa pronunciación o cadencia a
        partir del texto.
      </p>
    </main>
  );
}

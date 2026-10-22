'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ContinueCallLink } from '@/components/practice/continue-call-link';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
import { useDrillCall } from '@/hooks/use-drill-call';
import { NATIVE_LANGUAGES, type NativeLanguage } from '@/lib/practice-options';
import { DRILL_STEPS, type DrillCorrection } from '@/lib/time-shifting';

type Review = {
  text: string;
  corrections: DrillCorrection[];
  feedback: string;
  saved: boolean;
  reused?: boolean;
};
export function TimeShiftingDrill({ agentName }: { agentName?: string }) {
  const call = useDrillCall();
  const [step, setStep] = useState(0);
  const [routine, setRoutine] = useState('');
  const [language, setLanguage] = useState<NativeLanguage>('es');
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState<number>(60);
  const [running, setRunning] = useState(false);
  const recording = call.capturing;
  const [captured, setCaptured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const stopAt = useRef(0);
  useEffect(() => {
    const stored = localStorage.getItem('native-language');
    if (stored && Object.hasOwn(NATIVE_LANGUAGES, stored)) setLanguage(stored as NativeLanguage);
  }, []);
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
  async function record() {
    setError('');
    try {
      await call.begin();
      setText('');
      setReviews((previous) => {
        const next = { ...previous };
        delete next[step];
        return next;
      });
      setCaptured(false);
      setRemaining(DRILL_STEPS[step].seconds);
      setRunning(true);
    } catch {
      setRunning(false);
    }
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
      form.set('previousPresent', reviews[0]?.text ?? '');
      form.set('text', transcript);
      const response = await fetch('/api/time-shifting', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falló la revisión.');
      setReviews((prev) => ({ ...prev, [step]: data }));
      setText(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión.');
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
  }
  return (
    <main className="drill-workspace">
      <Link className="study-text-link text-sm" href="/home">
        Volver a las prácticas
      </Link>
      <header className="mt-8 mb-10 max-w-2xl">
        <p className="text-muted-foreground mb-3 text-sm">Práctica B / Bloque 1 / 7 minutos</p>
        <h1 className="study-title">
          La misma idea.
          <br />
          En otro tiempo.
        </h1>
        <p className="text-muted-foreground mt-5 leading-7">
          7 minutos de ejercicio con llamada y transcripción automática. Habla en inglés a tu ritmo:
          el tutor escucha sin interrumpir. Pulsa «Terminé este paso» para recibir la revisión
          escrita.
        </p>
        <p className="text-muted-foreground mt-3 text-sm">
          El micrófono transcribe solo en inglés. Las preguntas en otro idioma se escriben en el
          chat de la llamada con el tutor; esta captura solo transcribe el ejercicio.
        </p>
      </header>
      <div className="drill-layout">
        <FluencyBlocks current={0} disabled={recording || busy} />
        <aside>
          <h2 className="mb-4 font-semibold">Gimnasia temporal</h2>
          <ol className="drill-step-list">
            {DRILL_STEPS.map((item, index) => (
              <li key={item.label} aria-current={step === index ? 'step' : undefined}>
                <span className="text-muted-foreground mb-1 block text-xs">
                  Paso {index + 1} · {item.seconds / 60} min{reviews[index] ? ' · revisado' : ''}
                </span>
                {item.label}
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-5 text-sm leading-6">
            Mantén las mismas acciones en cada ronda. Lo que cambia es cuándo suceden.
          </p>
        </aside>
        <div className="drill-content space-y-5">
          <section
            className="space-y-3 rounded-xl border p-4"
            aria-label="Llamada de transcripción"
          >
            <h2 className="font-semibold">Habla; el texto aparece aquí</h2>
            <p className="text-muted-foreground text-sm" role="status">
              {call.pending
                ? 'Preparando llamada o transcripción…'
                : !call.connected
                  ? 'Conecta la llamada antes de empezar.'
                  : !call.ready
                    ? 'Llamada conectada. Esperando al agente de transcripción…'
                    : recording
                      ? 'Micrófono abierto. Las pausas no terminan el paso.'
                      : 'Llamada lista. Micrófono cerrado hasta que empieces un paso.'}
            </p>
            {!call.connected ? (
              <button
                className="study-button"
                disabled={busy || call.pending}
                onClick={() => void call.connect(language, agentName)}
              >
                Conectar llamada
              </button>
            ) : (
              <button
                className="study-next-step"
                disabled={busy || call.pending}
                onClick={() => void call.disconnect()}
              >
                {recording ? 'Colgar sin revisar este paso' : 'Cerrar llamada'}
              </button>
            )}
            {call.error && (
              <p role="alert" className="text-destructive text-sm">
                {call.error}
              </p>
            )}
          </section>
          <label className="block text-sm font-medium">
            Idioma de las explicaciones
            <select
              className="study-field"
              value={language}
              disabled={busy || call.pending || call.connected}
              onChange={(e) => {
                setLanguage(e.target.value as NativeLanguage);
                localStorage.setItem('native-language', e.target.value);
              }}
            >
              {Object.entries(NATIVE_LANGUAGES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Tu rutina o proceso (las mismas 3–4 acciones en A, B y C)
            <input
              className="study-field"
              placeholder="Por ejemplo: despertar, preparar café, ir al trabajo…"
              maxLength={500}
              value={routine}
              disabled={busy || call.pending || step > 0 || recording || captured}
              onChange={(e) => setRoutine(e.target.value)}
            />
          </label>
          <h2 className="pt-4 text-2xl font-semibold">
            {DRILL_STEPS[step].label} · paso {step + 1}/4
          </h2>
          <p className="text-muted-foreground leading-7">{DRILL_STEPS[step].instruction}</p>
          <div className="drill-clock">
            <p
              className="font-mono text-5xl tracking-tight"
              role="timer"
              aria-label="Tiempo restante del paso"
            >
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </p>
            <span className="text-muted-foreground text-sm" role="status">
              {recording
                ? 'Grabando tu respuesta'
                : busy
                  ? 'Revisión en curso'
                  : running
                    ? 'Tiempo de práctica'
                    : remaining === 0
                      ? 'Tiempo del paso terminado'
                      : 'A tu ritmo'}
            </span>
          </div>
          <div className="drill-controls">
            <button
              disabled={busy || call.pending || !call.ready || recording || !routine.trim()}
              onClick={() => void record()}
            >
              {captured || text ? 'Repetir captura del paso' : 'Empezar a hablar'}
            </button>
            <button
              disabled={busy || call.pending || !recording || remaining === 0}
              onClick={() => setRunning((v) => !v)}
            >
              {running ? 'Pausar cronómetro' : 'Continuar cronómetro'}
            </button>
          </div>
          <p className="text-muted-foreground text-xs leading-6">
            Pausar el cronómetro no cierra el micrófono. Al terminar el paso se cierra para revisar.
            La transcripción llega por fragmentos al detectar pausas; puede tardar unos segundos.
          </p>
          <label className="block text-sm font-medium">
            Transcripción automática de tu respuesta
            <textarea
              className="study-field min-h-44 resize-y leading-7"
              placeholder="Lo que digas durante este paso aparecerá aquí. No necesitas escribirlo."
              value={text}
              maxLength={8000}
              readOnly
            />
          </label>
          <button
            className="study-button"
            disabled={busy || call.pending || !routine.trim() || (!recording && !captured)}
            onClick={() => void review()}
          >
            {busy
              ? 'Cerrando transcripción / revisando…'
              : recording || !captured
                ? 'Terminé este paso'
                : 'Reintentar revisión escrita'}
          </button>
          {error && (
            <p role="alert" className="text-red-500">
              {error}
            </p>
          )}
          {result && (
            <section className="drill-review space-y-4" aria-live="polite">
              <h2 className="text-xl font-semibold">Revisión escrita</h2>
              {result.reused && (
                <p>
                  Revisión guardada reutilizada: no se hicieron nuevas llamadas a la IA ni se contó
                  otra evidencia de aprendizaje.
                </p>
              )}
              <p>{result.feedback}</p>
              {!result.corrections.length && (
                <p>No se detectaron errores claros en esta revisión. Esto no certifica dominio.</p>
              )}
              {result.corrections.map((c, i) => (
                <article key={i} className="drill-correction space-y-3">
                  <p>
                    <span className="text-muted-foreground block text-xs">Tu frase</span>
                    {c.original}
                  </p>
                  <p>
                    <span className="text-muted-foreground block text-xs">Corrección</span>
                    <strong>{c.corrected}</strong>
                  </p>
                  <p className="text-sm leading-6">{c.explanation}</p>
                  <p className="text-sm">Estructura: {c.pattern}</p>
                </article>
              ))}
              <p>
                Guardado como ensayo; no cuenta como aprendizaje consolidado. La transcripción puede
                contener errores de reconocimiento.
              </p>
            </section>
          )}
          {step < 3 ? (
            <button
              className="study-next-step"
              disabled={!result || busy || call.pending || recording}
              onClick={next}
            >
              Siguiente paso
            </button>
          ) : (
            result && !busy && !recording && <ContinueCallLink />
          )}
          <p className="text-muted-foreground border-t pt-5 text-xs leading-6">
            Esta llamada consume minutos de LiveKit y transcripción de Groq. DeepSeek solo revisa al
            terminar el paso; no hay voz del tutor ni peticiones al modelo durante tus pausas. Las
            claves permanecen en el servidor.
          </p>
        </div>
      </div>
    </main>
  );
}

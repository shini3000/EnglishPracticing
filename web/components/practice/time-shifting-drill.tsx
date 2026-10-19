'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { NATIVE_LANGUAGES, type NativeLanguage } from '@/lib/practice-options';
import { DRILL_STEPS, type DrillCorrection } from '@/lib/time-shifting';

type Review = {
  text: string;
  corrections: DrillCorrection[];
  feedback: string;
  saved: boolean;
  reused?: boolean;
};
export function TimeShiftingDrill() {
  const [step, setStep] = useState(0);
  const [routine, setRoutine] = useState('');
  const [language, setLanguage] = useState<NativeLanguage>('es');
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState<number>(60);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopAt = useRef(0);
  useEffect(() => {
    const stored = localStorage.getItem('native-language');
    if (stored && Object.hasOwn(NATIVE_LANGUAGES, stored)) setLanguage(stored as NativeLanguage);
  }, []);
  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );
  useEffect(() => {
    if (!running) return;
    stopAt.current = Date.now() + remaining * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((stopAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (!left) {
        setRunning(false);
        if (recorder.current?.state === 'recording') recorder.current.stop();
      }
    }, 250);
    return () => clearInterval(id);
    // remaining is intentionally captured only on start/resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const result = reviews[step];
  async function record() {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error('Tu navegador no permite grabar. Usa texto o una transcripción.');
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream.current);
      recorder.current = media;
      const chunks: BlobPart[] = [];
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      media.onstop = () => {
        setAudio(new Blob(chunks, { type: media.mimeType }));
        setRecording(false);
        setRunning(false);
        stream.current?.getTracks().forEach((t) => t.stop());
      };
      media.start();
      setAudio(null);
      setRecording(true);
      setRunning(true);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(e instanceof Error ? e.message : 'No se pudo abrir el micrófono.');
    }
  }
  async function review() {
    setBusy(true);
    setError('');
    setRunning(false);
    try {
      const form = new FormData();
      form.set('step', String(step));
      form.set('routine', routine);
      form.set('language', language);
      form.set('previousPresent', reviews[0]?.text ?? '');
      if (audio)
        form.set('audio', audio, audio.type.includes('mp4') ? 'answer.mp4' : 'answer.webm');
      else form.set('text', text);
      const response = await fetch('/api/time-shifting', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falló la revisión.');
      setReviews((prev) => ({ ...prev, [step]: data }));
      setText(data.text);
      setAudio(null);
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
    setAudio(null);
    setRemaining(DRILL_STEPS[index].seconds);
    setRunning(false);
  }
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6">
      <Link href="/home">← Inicio</Link>
      <h1 className="text-2xl font-semibold">Práctica B · Bloque 1 · Gimnasia temporal</h1>
      <p>
        7 minutos de ejercicio, sin llamada ni voz del tutor. Habla en inglés; la IA solo revisa
        cuando pulsas el botón. El tiempo de revisión no cuenta como producción.
      </p>
      <label className="block">
        Idioma de las explicaciones
        <select
          className="bg-background block rounded border p-2"
          value={language}
          disabled={busy || recording}
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
      <label className="block">
        Tu rutina o proceso (las mismas 3–4 acciones en A, B y C)
        <input
          className="block w-full rounded border p-2"
          maxLength={500}
          value={routine}
          disabled={busy || step > 0 || recording}
          onChange={(e) => setRoutine(e.target.value)}
        />
      </label>
      <h2 className="text-xl">
        {DRILL_STEPS[step].label} · paso {step + 1}/4
      </h2>
      <p>{DRILL_STEPS[step].instruction}</p>
      <p className="font-mono text-4xl" role="timer">
        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded border p-2"
          disabled={busy || recording || remaining === 0}
          onClick={() => setRunning((v) => !v)}
        >
          {running ? 'Pausar cronómetro' : 'Iniciar cronómetro'}
        </button>
        <button
          className="rounded border p-2"
          disabled={busy || !routine.trim() || remaining === 0}
          onClick={() => (recording ? recorder.current?.stop() : void record())}
        >
          {recording ? 'Detener grabación' : 'Grabar respuesta'}
        </button>
        <button
          className="rounded border p-2"
          disabled={busy || recording}
          onClick={() => {
            setRunning(false);
            setRemaining(DRILL_STEPS[step].seconds);
          }}
        >
          Reiniciar tiempo del paso
        </button>
      </div>
      {audio && (
        <p>
          Audio preparado. Puedes enviarlo a revisión o volver a grabar. No se guarda el archivo de
          audio.
        </p>
      )}
      <label className="block">
        Respuesta o transcripción
        <textarea
          className="block min-h-32 w-full rounded border p-2"
          placeholder="También puedes pegar una transcripción fiel. No se corrige mientras hablas."
          value={text}
          maxLength={8000}
          disabled={busy || recording || !!audio}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button
        className="rounded border p-2"
        disabled={busy || recording || !routine.trim() || (!text.trim() && !audio)}
        onClick={() => void review()}
      >
        {busy ? 'Transcribiendo / revisando…' : 'Revisar gramática por escrito'}
      </button>
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      {result && (
        <section className="space-y-3 rounded border p-4" aria-live="polite">
          <h2>Revisión escrita</h2>
          {result.reused && (
            <p>
              Revisión guardada reutilizada: no se hicieron nuevas llamadas a la IA ni se contó otra
              evidencia de aprendizaje.
            </p>
          )}
          <p>{result.feedback}</p>
          {!result.corrections.length && (
            <p>No se detectaron errores claros en esta revisión. Esto no certifica dominio.</p>
          )}
          {result.corrections.map((c, i) => (
            <article key={i} className="rounded border p-3">
              <p>Tu frase: {c.original}</p>
              <p>Corrección: {c.corrected}</p>
              <p>{c.explanation}</p>
              <p>Estructura: {c.pattern}</p>
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
          className="rounded border p-2"
          disabled={!result || busy || recording}
          onClick={next}
        >
          Siguiente paso
        </button>
      ) : (
        result && (
          <Link className="block underline" href="/call?practice=fluency&start=anchors">
            Continuar al bloque 2 con el tutor (abrir preparación, sin llamar todavía)
          </Link>
        )
      )}
      <p className="text-muted-foreground text-sm">
        Grabar utiliza Groq para transcripción; revisar utiliza DeepSeek. No consume minutos de
        LiveKit, pero sí cuota/saldo de esas APIs. Las claves permanecen en el servidor.
      </p>
    </main>
  );
}

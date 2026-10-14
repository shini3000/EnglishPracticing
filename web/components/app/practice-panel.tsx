'use client';

import { useEffect, useState } from 'react';
import { useDataChannel, useSessionContext } from '@livekit/components-react';

type Timer = {
  step: string;
  remaining_seconds: number;
  elapsed_seconds: number;
  running: boolean;
  started: boolean;
  finished: boolean;
};
type JournalEntry = { kind: string; date: string; [key: string]: unknown };

export function PracticePanel() {
  const { isConnected } = useSessionContext();
  const [timer, setTimer] = useState<Timer | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [saved, setSaved] = useState(true);
  const [material, setMaterial] = useState<{ url: string; title: string } | null>(null);
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
      setSaved(data.saved);
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
    fetch('/api/practice-journal')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setEntries(data.entries);
          setSaved(data.available);
        }
      })
      .catch(() => setSaved(false));
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);
  if (!isConnected) return null;
  const remaining = timer
    ? Math.max(
        0,
        timer.remaining_seconds -
          (timer.running ? Math.floor(Math.max(0, now - receivedAt) / 1000) : 0)
      )
    : 0;
  return (
    <aside className="bg-background/95 fixed top-20 right-3 z-50 max-h-[65vh] w-72 overflow-auto rounded-xl border p-3 shadow-sm">
      <p className="text-sm font-medium">{timer?.step ?? 'Preparando práctica'}</p>
      <p className="text-muted-foreground text-xs" aria-live="off">
        {!timer?.started
          ? 'El cronómetro comienza al confirmar el tema.'
          : timer.finished
            ? 'Sesión finalizada'
            : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} · ${timer.running ? 'en curso' : 'pausa'}`}
      </p>
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
      <details className="mt-3">
        <summary className="cursor-pointer text-sm">
          Registro acumulativo ({entries.length})
        </summary>
        {!saved && (
          <p className="mt-2 text-xs">
            Guardado no disponible: conserva estas notas antes de salir.
          </p>
        )}
        {entries.map((entry, index) => (
          <div key={index} className="mt-2 border-t pt-2 text-xs">
            <p className="font-medium">
              {entry.date} · {entry.kind}
            </p>
            <pre className="mt-1 font-sans break-words whitespace-pre-wrap">
              {JSON.stringify(entry, null, 2)}
            </pre>
          </div>
        ))}
      </details>
    </aside>
  );
}

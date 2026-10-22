'use client';

import { useEffect, useReducer } from 'react';
import Link from 'next/link';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
import { INPUT_REPLICA_STEPS, initialInputClock, inputClock } from '@/lib/input-replica';

export function InputReplica() {
  const [clock, dispatch] = useReducer(inputClock, initialInputClock);
  useEffect(() => {
    if (clock.deadline === null) return;
    const interval = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 250);
    return () => clearInterval(interval);
  }, [clock.deadline]);
  const step = INPUT_REPLICA_STEPS[clock.index];
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/practice-b" className="study-text-link text-sm">
        Volver a los bloques
      </Link>
      <FluencyBlocks current={2} />
      <p className="text-muted-foreground mt-8 text-sm">
        Práctica B · Bloque 3 · 15 minutos · Sin llamada
      </p>
      <h1 className="study-title mt-3">Input activo con réplica inmediata</h1>
      <p className="text-muted-foreground mt-5 leading-7">
        Mira o escucha material en inglés y responde en voz alta por tu cuenta. Esta actividad no
        abre el micrófono, no transcribe ni envía tus respuestas a un modelo.
      </p>
      <section className="bg-card mt-8 rounded-2xl border p-6" aria-labelledby="input-step">
        <p className="text-muted-foreground text-sm">Paso {clock.index + 1} de 4</p>
        <h2 id="input-step" className="mt-2 text-xl font-semibold">
          {step.title}
        </h2>
        <p className="mt-4 leading-7">{step.instruction}</p>
        <p
          role="timer"
          aria-label="Tiempo restante"
          className="my-6 font-mono text-5xl tabular-nums"
        >
          {Math.floor(clock.remaining / 60)}:{String(clock.remaining % 60).padStart(2, '0')}
        </p>
        <p role="status" className="text-muted-foreground text-sm">
          {clock.finished
            ? 'Recorrido terminado por ti. No se ha evaluado tu respuesta ni certificado aprendizaje.'
            : clock.remaining === 0
              ? 'Tiempo cumplido. Termina tu respuesta y avanza cuando estés listo.'
              : clock.deadline !== null
                ? 'En curso. Puedes pausar para preparar el material.'
                : 'En pausa. Inicia el cronómetro cuando estés listo.'}
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
                {clock.deadline === null ? 'Iniciar / continuar' : 'Pausar'}
              </button>
              <button className="study-text-link" onClick={() => dispatch({ type: 'next' })}>
                {clock.index === 3 ? 'Terminé el bloque' : 'Siguiente paso'}
              </button>
            </>
          )}
          <button className="study-text-link" onClick={() => dispatch({ type: 'reset' })}>
            Reiniciar este paso
          </button>
        </div>
      </section>
      <ol className="mt-6 space-y-2" aria-label="Etapas del bloque 3">
        {INPUT_REPLICA_STEPS.map((item, index) => (
          <li
            key={item.title}
            aria-current={!clock.finished && index === clock.index ? 'step' : undefined}
            className={`border-l-2 py-2 pl-4 ${index === clock.index ? 'border-primary text-primary' : 'text-muted-foreground'}`}
          >
            {index + 1}. {item.title} · {item.seconds / 60} min
          </li>
        ))}
      </ol>
      <Link href="/practice-b/agility" className="study-button mt-8">
        Ir al bloque 4 · Transcripción y corrección escrita
      </Link>
      <p className="text-muted-foreground mt-3 text-xs">
        El cronómetro no cambia de paso automáticamente. Cambiar de bloque no inicia otra llamada
        por sí solo.
      </p>
    </main>
  );
}

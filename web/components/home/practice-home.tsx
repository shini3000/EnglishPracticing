import Link from 'next/link';
import {
  ChartLineUpIcon,
  ClockIcon,
  MicrophoneIcon,
  PencilLineIcon,
} from '@phosphor-icons/react/dist/ssr';
import { AppShell } from '@/components/layout/app-shell';
import type { Learner } from '@/lib/learners';

export function PracticeHome({
  learner,
  overview,
}: {
  learner: Learner;
  overview: React.ReactNode;
}) {
  return (
    <AppShell learner={learner} active="home">
      <header className="study-intro">
        <div>
          <p className="text-muted-foreground mb-3 text-sm">Tu espacio de entrenamiento</p>
          <h1 className="study-title">
            Un poco más de inglés,
            <br />
            {learner.displayName}.
          </h1>
          <p className="text-muted-foreground mt-5 max-w-lg leading-7">
            Elige cómo quieres practicar hoy. Habla a tu ritmo, revisa tus errores por escrito y
            vuelve a usar lo aprendido.
          </p>
        </div>
        <div className="study-summary">
          <h2 className="font-semibold">Tu recorrido</h2>
          {overview}
          <Link href="/progress" className="study-text-link mt-5 inline-flex items-center gap-2">
            <ChartLineUpIcon size={18} />
            Ver mi progreso
          </Link>
        </div>
      </header>
      <section aria-labelledby="practice-heading" className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 id="practice-heading" className="text-xl font-semibold">
            Tu práctica de hoy
          </h2>
          <Link href="/call?practice=diagnostic" className="study-text-link text-sm">
            ¿Por dónde empezar? Hacer diagnóstico
          </Link>
        </div>
        <div className="practice-routes">
          <article className="practice-route route-integral">
            <div className="flex items-center justify-between gap-3">
              <span className="route-letter" aria-hidden="true">
                A
              </span>
              <span className="flex items-center gap-2 text-sm">
                <ClockIcon size={18} />
                145 minutos
              </span>
            </div>
            <h3>Entrenamiento integral</h3>
            <p>
              Conecta conversación, gramática y escucha en una práctica guiada de principio a fin.
            </p>
            <ul>
              <li>Recuperación y conversación</li>
              <li>Escucha, shadowing y vocabulario</li>
              <li>Uso de lo aprendido en otro contexto</li>
            </ul>
            <Link href="/call?practice=daily" className="study-button">
              <MicrophoneIcon size={18} />
              Preparar práctica A
            </Link>
          </article>
          <article className="practice-route route-fluency">
            <div className="flex items-center justify-between gap-3">
              <span className="route-letter" aria-hidden="true">
                B
              </span>
              <span className="flex items-center gap-2 text-sm">
                <ClockIcon size={18} />
                55 minutos
              </span>
            </div>
            <h3>Fluidez y resistencia</h3>
            <p>Entrena los cambios de tiempo verbal y aprende a sostener una idea sin detenerte.</p>
            <ul>
              <li>Gimnasia temporal con transcripción automática</li>
              <li>Anclas temporales, escucha y réplica</li>
              <li>Rondas 4–3–2 y microauditoría</li>
            </ul>
            <Link href="/drill" className="study-button">
              Empezar práctica B
            </Link>
            <Link href="/call?practice=fluency" className="study-text-link mt-3 text-sm">
              Preparar B con el tutor
            </Link>
          </article>
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          Puedes pausar o terminar antes. Los pasos pendientes no se marcarán como completados.
        </p>
      </section>
      <section className="study-bottom-grid mt-10" aria-label="Más formas de avanzar">
        <div className="quick-drill">
          <PencilLineIcon size={26} weight="duotone" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">¿Tienes siete minutos?</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              Practica presente, pasado y present perfect. Habla en una llamada: tu respuesta se
              transcribe automáticamente y se revisa por escrito al terminar.
            </p>
            <Link href="/drill" className="study-text-link mt-4 inline-block">
              Abrir gimnasia temporal
            </Link>
          </div>
        </div>
        <aside className="learning-note">
          <h2 className="font-semibold">Una palabra se aprende al volver a usarla.</h2>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            Una buena respuesta es un ensayo, no dominio. Tu progreso distingue lo que estás
            practicando de lo que puedes usar de forma constante en distintos días y contextos.
          </p>
        </aside>
      </section>
    </AppShell>
  );
}

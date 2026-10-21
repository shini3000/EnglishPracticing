import type { Sql } from '@/lib/db';
import { buildPracticeOverview } from '@/lib/progress/overview';

/** Optional streamed indicators: a failure must never prevent choosing a practice. */
export async function PracticeOverview({ sql, learnerId }: { sql: Sql; learnerId: string }) {
  try {
    const overview = await buildPracticeOverview(sql, learnerId);
    if (!overview.sessions)
      return (
        <p className="text-muted-foreground mt-4 text-sm leading-6">
          Todavía no hay sesiones registradas. Empieza con el diagnóstico o elige una práctica; aquí
          verás tu recorrido real.
        </p>
      );
    return (
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
        <div>
          <dt>Tiempo practicado</dt>
          <dd>
            {overview.practiceMinutes} <span>min</span>
          </dd>
        </div>
        <div>
          <dt>Días consecutivos</dt>
          <dd>{overview.currentStreakDays}</dd>
        </div>
        <div>
          <dt>Sesiones</dt>
          <dd>{overview.sessions}</dd>
        </div>
        <div>
          <dt>Nivel estimado{overview.level.isProvisional ? ' (provisional)' : ''}</dt>
          <dd>{overview.level.band ?? 'Por conocer'}</dd>
        </div>
      </dl>
    );
  } catch {
    return (
      <p role="status" className="text-muted-foreground mt-4 text-sm leading-6">
        No se pudo cargar el resumen. Puedes elegir una práctica igualmente.
      </p>
    );
  }
}

import type { Sql } from '@/lib/db';
import { getActivity, groupActivity } from '@/lib/progress/activity';
import { formatPracticeDateTime } from '@/lib/progress/dates';

export async function ActivityHistory({ sql, learnerId }: { sql: Sql; learnerId: string }) {
  let activities;
  try {
    activities = await getActivity(sql, learnerId);
  } catch {
    return (
      <p className="my-6 rounded border p-4">
        Historial no disponible. No se han borrado tus ejercicios.
      </p>
    );
  }
  const days = groupActivity(activities);
  return (
    <section className="my-8 space-y-4">
      <h2 className="text-xl font-semibold">Historial por día · Colombia</h2>
      <p>
        {days.length} días distintos en el historial mostrado ·{' '}
        {activities.filter((a) => a.type === 'call').length} llamadas ·{' '}
        {activities.filter((a) => a.type === 'drill').length} respuestas de gimnasia temporal
        revisadas.
      </p>
      <p className="text-muted-foreground text-sm">
        Varias prácticas en una fecha cuentan como un solo día. Cada envío conserva su hora y
        correcciones; una revisión no equivale a una práctica completa ni a dominio. Se muestran
        hasta 200 llamadas y 200 revisiones recientes.
      </p>
      {!days.length && <p>Todavía no hay actividades guardadas.</p>}
      {days.map(({ day, activities: entries }) => (
        <details key={day} className="rounded border p-4" open={day === days[0].day}>
          <summary>
            {day} · {entries.length} actividades
          </summary>
          {entries.map((entry) => (
            <article key={entry.id} className="my-3 border-t pt-3">
              <p>
                {formatPracticeDateTime(entry.at)} · {entry.label}
              </p>
              {entry.text && (
                <details>
                  <summary>Ver respuesta y revisión guardadas</summary>
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                  <p>{entry.feedback}</p>
                  {entry.corrections?.map((c, i) => (
                    <div key={i} className="mt-2">
                      <p>Tu frase: {c.original}</p>
                      <p>Corrección: {c.corrected}</p>
                      <p>{c.explanation}</p>
                    </div>
                  ))}
                </details>
              )}
            </article>
          ))}
        </details>
      ))}
    </section>
  );
}

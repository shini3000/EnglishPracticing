'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import type { LearningSummary } from '@/lib/progress/learning';

export function LearningDashboard({ initial }: { initial: LearningSummary }) {
  const [summary, setSummary] = useState(initial);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/learning-progress', { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo actualizar.');
      const next = await res.json();
      if (!next.available) throw new Error('Registro de aprendizaje no disponible.');
      setSummary(next);
    } catch {
      setError('No se pudo actualizar. Se mantiene la última información disponible.');
    } finally {
      setBusy(false);
    }
  }
  const items = summary.items.filter(
    (i) => filter === 'all' || i.item_type === filter || (filter === 'due' && i.due)
  );
  const total = summary.totals;
  return (
    <section className="mb-10 space-y-5" aria-label="Aprendizaje acumulativo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tu aprendizaje, práctica a práctica</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
            Usar una palabra una vez no demuestra que la aprendiste. Consolidación: al menos tres
            días correctos sin ayuda, siete días de separación y dos contextos. Una repetición o
            lectura no cuenta. Son evidencias del tutor sobre transcripciones, no una certificación.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={busy}>
          {busy ? 'Actualizando…' : 'Actualizar progreso'}
        </Button>
      </div>
      {error && (
        <p role="status" className="text-sm">
          {error}
        </p>
      )}
      {!summary.available ? (
        <p className="rounded-lg border p-4">
          El registro no está disponible. Configura la base de datos, aplica el esquema y
          reconstruye las evidencias anteriores. No se muestran ceros como si fueran datos reales.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Elementos trabajados', total.introduced],
              ['En consolidación', total.consolidating],
              ['Consolidados', total.consolidated],
              ['Repasos pendientes', total.due],
              ['Días con recuperación', total.practiceDays],
              ['Minutos cronometrados', total.measuredMinutes],
              ['Usos sin ayuda', total.unaided],
              [
                'Éxito sin ayuda',
                total.successRate === null ? 'Sin datos' : total.successRate + '%',
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Vocabulario: {total.vocabulary} · Estructuras: {total.structures} · Con ayuda:{' '}
            {total.helped} · Fallos: {total.failed}. El porcentaje incluye solo intentos observados
            de revisión o transferencia. El tiempo registrado incluye actividades, no solo habla;
            las llamadas sin cierre guardado no suman minutos aquí.
          </p>
          <div className="rounded-xl border p-4">
            <h2 className="font-semibold">Recuperación a lo largo de los días</h2>
            {summary.trend.length === 0 ? (
              <p className="mt-3 text-sm">
                Todavía no hay intentos verificados. Las entradas antiguas sin contexto se
                conservan, pero no acreditan dominio.
              </p>
            ) : (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="unaided" name="Sin ayuda" fill="#15803d" />
                    <Bar dataKey="helped" name="Con ayuda" fill="#d97706" />
                    <Bar dataKey="failed" name="Falló" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Vocabulario y estructuras</h2>
            <select
              aria-label="Filtrar aprendizaje"
              className="bg-background rounded border p-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="vocabulary">Vocabulario</option>
              <option value="structure">Estructuras</option>
              <option value="due">Repasos pendientes</option>
            </select>
          </div>
          {!items.length && (
            <p className="text-muted-foreground text-sm">
              Aún no hay elementos en este filtro. Comienza una práctica para registrar evidencia.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.item_type + item.key} className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">
                  {item.item_type === 'structure' ? 'Estructura' : 'Vocabulario'}
                </p>
                <h3 className="mt-1 font-semibold">{item.label}</h3>
                <p className="mt-1 text-sm">{item.state}</p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Días correctos: {item.successful_days.length}/{item.policy.min_days} · Separación:{' '}
                  {item.span_days}/{item.policy.min_span_days} días · Contextos:{' '}
                  {item.context_count}/{item.policy.min_contexts}
                </p>
                <p className="mt-2 text-xs">
                  Próximo repaso: {item.next_review ?? 'Por programar'}{' '}
                  {item.due ? '· pendiente' : ''}
                </p>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer">
                    Ver evidencia ({item.attempt_count} intentos)
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {item.attempts.map((attempt, index) => (
                      <li key={index} className="border-t pt-2 text-xs">
                        {attempt.date} ·{' '}
                        {attempt.result === 'unaided'
                          ? 'Sin ayuda'
                          : attempt.result === 'helped'
                            ? 'Con ayuda'
                            : 'Falló'}{' '}
                        · {attempt.context || 'Sin contexto registrado'}
                        <p className="mt-1">{attempt.evidence}</p>
                        {(!attempt.observed ||
                          attempt.attempt_type === 'repetition' ||
                          attempt.attempt_type === 'legacy') && (
                          <p className="text-muted-foreground">
                            No acredita consolidación: repetición o evidencia no verificada.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

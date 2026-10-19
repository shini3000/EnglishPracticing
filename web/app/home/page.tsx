import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PracticeHome } from '@/components/home/practice-home';
import { getDb } from '@/lib/db';
import { requireLearnerId } from '@/lib/guard';
import { getLearner } from '@/lib/learners';
import { buildSummary } from '@/lib/progress/summary';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const learnerId = await requireLearnerId();
  const sql = getDb();
  if (!sql)
    return (
      <main className="study-empty">
        <h1 className="study-title">El progreso no está disponible</h1>
        <p>
          La base de datos no está conectada. Puedes practicar con el tutor, pero esta sesión no se
          guardará.
        </p>
        <Link className="study-button" href="/call">
          Preparar una llamada
        </Link>
      </main>
    );
  const learner = await getLearner(sql, learnerId);
  if (!learner) redirect('/login');
  const summary = await buildSummary(sql, learnerId);
  return <PracticeHome learner={learner} summary={summary} />;
}

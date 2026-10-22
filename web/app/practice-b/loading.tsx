import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main role="status" aria-busy="true" className="mx-auto max-w-3xl px-6 py-10">
      <p>Cargando los bloques de la práctica B…</p>
      <Skeleton className="mt-8 h-16 w-full" />
      <div className="fluency-block-grid" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((block) => (
          <Skeleton key={block} className="min-h-60 w-full rounded-2xl" />
        ))}
      </div>
    </main>
  );
}

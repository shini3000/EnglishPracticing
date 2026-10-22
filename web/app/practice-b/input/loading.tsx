import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main role="status" aria-busy="true" className="mx-auto max-w-3xl px-6 py-10">
      <p>Cargando las instrucciones del bloque 3…</p>
      <Skeleton className="mt-8 h-20 w-full" />
      <Skeleton className="mt-8 h-80 w-full rounded-2xl" />
    </main>
  );
}

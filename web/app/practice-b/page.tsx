import Link from 'next/link';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
import { requireLearnerId } from '@/lib/guard';

export default async function PracticeBPage() {
  await requireLearnerId();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/home" className="study-text-link text-sm">
        Volver a las prácticas
      </Link>
      <h1 className="study-title mt-8">Fluidez y resistencia</h1>
      <p className="mt-6 leading-7">
        Elige por dónde empezar o retoma el bloque donde te quedaste, sin repetir los anteriores.
      </p>
      <FluencyBlocks variant="cards" />
      <p className="text-muted-foreground text-sm">
        Seleccionar un bloque no inicia una llamada. Retomas desde el comienzo del bloque elegido,
        no desde el minuto exacto de una llamada anterior.
      </p>
    </main>
  );
}

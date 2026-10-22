'use client';

import Link, { useLinkStatus } from 'next/link';

function NavigationStatus() {
  const { pending } = useLinkStatus();
  return (
    <span role="status" aria-live="polite" aria-busy={pending}>
      {pending
        ? 'Cargando la preparación de la llamada…'
        : 'Continuar al bloque 2 con el tutor (abrir preparación, sin llamar todavía)'}
    </span>
  );
}

/** Keep real Link behavior (including new tabs) and reflect the router, not a timer. */
export function ContinueCallLink() {
  return (
    <Link className="study-text-link block" href="/call?practice=fluency&start=anchors">
      <NavigationStatus />
    </Link>
  );
}

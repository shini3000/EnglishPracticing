'use client';

import { useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { SignOutIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        aria-label="Cerrar sesión"
        className="text-muted-foreground hover:text-foreground gap-1.5"
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            await signOut();
            // Discard all client-cached pages belonging to the previous user.
            window.location.assign('/login');
          } catch {
            setError(true);
            setBusy(false);
          }
        }}
      >
        <SignOutIcon size={16} weight="bold" />
        <span>{busy ? 'Saliendo…' : 'Salir'}</span>
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          No se pudo cerrar sesión. Reintenta.
        </p>
      )}
    </div>
  );
}

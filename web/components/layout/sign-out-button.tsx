'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useClerk } from '@clerk/nextjs';
import { SignOutIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const t = useTranslations('ui');

  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        aria-label={t('mc6e6960395f4')}
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
        <span>{busy ? t('md435eba3f2a6') : t('m93fffbf7ce79')}</span>
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {t('mff0bf170f4ca')}
        </p>
      )}
    </div>
  );
}

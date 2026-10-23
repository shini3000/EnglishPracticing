'use client';

import { useTranslations } from 'next-intl';
import Link, { useLinkStatus } from 'next/link';

function NavigationStatus() {
  const t = useTranslations('ui');

  const { pending } = useLinkStatus();
  return (
    <span role="status" aria-live="polite" aria-busy={pending}>
      {pending ? t('md2bebde63d3a') : t('ma441ef155375')}
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

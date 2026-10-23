import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

/** No session, microphone or LiveKit token is needed to display route loading. */
export function CallPreparationSkeleton() {
  const t = useTranslations('ui');

  return (
    <main className="grid min-h-svh grid-cols-1 content-center py-8 pb-20">
      <div className="call-preparation w-full">
        <Link href="/home" className="study-text-link text-sm">
          {t('m23e939f389fb')}
        </Link>
        <div role="status" aria-live="polite" aria-busy="true" className="mt-5">
          <p className="text-muted-foreground text-sm">{t('m57b014838742')}</p>
          <p className="text-muted-foreground mt-2 text-xs">{t('mefe0c498706b')}</p>
          <div aria-hidden="true" className="call-preparation-grid">
            <div>
              <Skeleton className="h-24 w-full max-w-md" />
              <Skeleton className="mt-5 h-20 w-full" />
              <div className="learning-note mt-8 border-t">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-4 h-16 w-full" />
                <Skeleton className="mt-4 h-12 w-full" />
              </div>
            </div>
            <div className="preparation-form">
              <Skeleton className="mb-6 h-7 w-3/4" />
              {[0, 1].map((key) => (
                <div key={key} className="mb-6 space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
              <div className="mt-8 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((key) => (
                  <Skeleton key={key} className="aspect-square w-full rounded-xl" />
                ))}
              </div>
              <Skeleton className="mt-8 h-12 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

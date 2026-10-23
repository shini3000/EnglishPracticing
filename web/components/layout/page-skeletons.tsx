import { useTranslations } from 'next-intl';
import { AppShell, type ShellTab } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function OverviewSkeleton() {
  const t = useTranslations('ui');

  return (
    <LoadingRegion
      label={t('md738b2e52a05')}
      className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 [&>div]:contents"
    >
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="space-y-2">
          <Skeleton className="h-3 w-28 max-w-full" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function LearningSkeleton() {
  const t = useTranslations('ui');

  return (
    <LoadingRegion label={t('me251b100a19b')} className="mb-10 space-y-5">
      <Skeleton className="mb-3 h-7 w-80 max-w-full" />
      <Skeleton className="mb-5 h-10 w-full max-w-3xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, key) => (
          <div key={key} className="bg-card rounded-xl border p-5">
            <Skeleton className="h-3 w-24 max-w-full" />
            <Skeleton className="mt-3 h-7 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-5 h-56 w-full rounded-xl" />
    </LoadingRegion>
  );
}

export function HistorySkeleton() {
  const t = useTranslations('ui');

  return (
    <LoadingRegion label={t('me886e878a1da')} className="my-8">
      <Skeleton className="mb-5 h-6 w-64 max-w-full" />
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} className="mb-3 h-16 w-full rounded-xl" />
      ))}
    </LoadingRegion>
  );
}

export function ChartsSkeleton() {
  const t = useTranslations('ui');

  return (
    <LoadingRegion label={t('m91889a171baa')} className="space-y-5">
      <Skeleton className="h-8 w-60 max-w-full" />
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </LoadingRegion>
  );
}

/** No identity or personal data is needed to show immediate navigation feedback. */
export function PageSkeleton({ active }: { active: ShellTab }) {
  const t = useTranslations('ui');

  return (
    <AppShell active={active} loading>
      <LoadingRegion label={active === 'home' ? t('mc068add86a36') : t('mdea7505f435b')}>
        {active === 'home' ? (
          <>
            <div className="study-intro">
              <div>
                <Skeleton className="mb-5 h-4 w-48" />
                <Skeleton className="h-28 w-full max-w-lg" />
                <Skeleton className="mt-5 h-14 w-full max-w-lg" />
              </div>
              <div className="study-summary">
                <Skeleton className="h-5 w-44" />
                <OverviewSkeleton />
              </div>
            </div>
            <Skeleton className="mt-12 mb-5 h-7 w-56" />
            <div className="practice-routes">
              {[0, 1].map((key) => (
                <div key={key} className="bg-card rounded-3xl border p-7">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="mt-6 h-7 w-3/4" />
                  <Skeleton className="mt-5 h-28 w-full" />
                  <Skeleton className="mt-8 h-12 w-full" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <Skeleton className="mb-4 h-14 w-full max-w-xl" />
            <Skeleton className="mb-10 h-14 w-full max-w-2xl" />
            <LearningSkeleton />
            <HistorySkeleton />
            <ChartsSkeleton />
          </>
        )}
      </LoadingRegion>
    </AppShell>
  );
}

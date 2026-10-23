import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  const t = useTranslations('ui');

  return (
    <main role="status" aria-busy="true" className="mx-auto max-w-3xl px-6 py-10">
      <p>{t('me332de9c9db6')}</p>
      <Skeleton className="mt-8 h-20 w-full" />
      <Skeleton className="mt-8 h-80 w-full rounded-2xl" />
    </main>
  );
}

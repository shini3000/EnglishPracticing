import { AppShell } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <AppShell loading active="profile">
      <div className="max-w-2xl space-y-6" role="status" aria-busy="true">
        <Skeleton className="h-12 w-52" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </AppShell>
  );
}

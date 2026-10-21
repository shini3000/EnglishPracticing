import { cn } from '@/lib/shadcn/utils';

/** Decorative only: its parent owns the accessible loading announcement. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-muted rounded-md motion-safe:animate-pulse', className)}
    />
  );
}

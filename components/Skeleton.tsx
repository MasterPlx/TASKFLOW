import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="card flex items-center gap-3 p-3">
      <Skeleton className="h-4 w-4 flex-none rounded" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-4 w-12 flex-none rounded-md" />
      <Skeleton className="h-4 w-16 flex-none rounded-md" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-6 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-7 w-12" />
    </div>
  );
}

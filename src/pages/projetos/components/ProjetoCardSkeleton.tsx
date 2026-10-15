export function ProjetoCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-2 rounded-lg border border-border bg-surface-card p-3">
      <div className="flex min-h-5 items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3.5 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
      <div className="h-1 w-full rounded bg-muted" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-3 w-10 rounded bg-muted" />
      </div>
    </div>
  );
}

export function ProjetoColumnSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <ProjetoCardSkeleton key={i} />
      ))}
    </div>
  );
}

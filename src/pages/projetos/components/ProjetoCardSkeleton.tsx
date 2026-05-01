export function ProjetoCardSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-3 space-y-2 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
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
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <ProjetoCardSkeleton key={i} />
      ))}
    </div>
  );
}

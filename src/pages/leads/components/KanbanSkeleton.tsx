import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto do quadro de leads enquanto os dados carregam. */
export function KanbanSkeleton() {
  const columns = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div className="flex-1 min-h-0" aria-hidden="true">
      <div className="hidden md:flex gap-3 w-full h-full min-h-0 overflow-x-auto pb-2">
        {columns.map((colIndex) => (
          <div key={colIndex} className="flex flex-col min-w-[280px] w-[280px] shrink-0 min-h-0">
            <div className="flex items-center gap-2 px-2 py-2.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex-1 min-h-0 p-2 space-y-2 rounded-lg bg-muted">
              {Array.from({ length: colIndex % 2 === 0 ? 3 : 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="md:hidden space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

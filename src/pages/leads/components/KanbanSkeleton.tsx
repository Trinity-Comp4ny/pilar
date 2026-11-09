import { Skeleton } from "@/components/ui/skeleton";
import { KANBAN_BOARD_CLASS, KANBAN_COLUMN_WIDTH } from "@/components/kanban/kanbanLayout";

/** Esqueleto do quadro de leads enquanto os dados carregam. */
export function KanbanSkeleton() {
  const columns = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div className="flex-1 min-h-0" aria-hidden="true">
      <div className={`hidden md:flex ${KANBAN_BOARD_CLASS}`}>
        {columns.map((colIndex) => (
          <div key={colIndex} className={`flex min-h-0 shrink-0 flex-col ${KANBAN_COLUMN_WIDTH}`}>
            <div className="flex h-10 items-center gap-2 px-1">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl bg-muted/40 p-2">
              {Array.from({ length: colIndex % 2 === 0 ? 3 : 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
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

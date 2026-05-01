import { cn } from "@/lib/utils";
import type { MySubscription } from "../hooks/useMySubscription";

const LABELS: Record<MySubscription["status"], string> = {
  active: "Ativa",
  trialing: "Trial",
  overdue: "Em atraso",
  canceled: "Cancelada",
  expired: "Expirada",
};

const COLORS: Record<MySubscription["status"], string> = {
  active: "bg-positive/10 text-positive border-positive/20",
  trialing: "bg-blue-100 text-blue-700 border-blue-200",
  overdue: "bg-amber-100 text-amber-700 border-amber-200",
  canceled: "bg-slate-100 text-slate-600 border-slate-200",
  expired: "bg-red-100 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: MySubscription["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider border",
        COLORS[status]
      )}
    >
      {LABELS[status]}
    </span>
  );
}

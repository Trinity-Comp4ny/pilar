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
  active: "bg-positive/10 text-positive-strong border-positive/20",
  trialing: "bg-info-soft text-info-strong border-info-mid-border",
  overdue: "bg-warning-soft text-warning-strong border-warning-mid-border",
  canceled: "bg-muted text-ink-muted border-border",
  expired: "bg-danger-soft text-danger-strong border-danger-mid-border",
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

import { cn } from "@/lib/utils";

export type BillingCycle = "monthly" | "yearly";

interface CycleToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  yearlySavingPct?: number;
}

export function CycleToggle({ value, onChange, yearlySavingPct }: CycleToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Ciclo de cobrança"
      className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "monthly"}
        onClick={() => onChange("monthly")}
        className={cn(
          "px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all",
          value === "monthly" ? "bg-ink-soft text-white" : "text-slate-500 hover:text-slate-800"
        )}
      >
        Mensal
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "yearly"}
        onClick={() => onChange("yearly")}
        className={cn(
          "px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-2",
          value === "yearly" ? "bg-ink-soft text-white" : "text-slate-500 hover:text-slate-800"
        )}
      >
        Anual
        {yearlySavingPct != null && yearlySavingPct > 0 && (
          <span className="text-[10px] bg-brand text-ink px-1.5 py-0.5 rounded-full">
            -{yearlySavingPct}%
          </span>
        )}
      </button>
    </div>
  );
}

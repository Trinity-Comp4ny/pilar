import { cn } from "@/lib/utils";

export type BillingCycle = "monthly" | "yearly";

interface CycleToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

export function CycleToggle({ value, onChange }: CycleToggleProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
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
        onClick={() => onChange("yearly")}
        className={cn(
          "px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-2",
          value === "yearly" ? "bg-ink-soft text-white" : "text-slate-500 hover:text-slate-800"
        )}
      >
        Anual
        <span className="text-[10px] bg-accent-orange text-ink px-1.5 py-0.5 rounded-full">-17%</span>
      </button>
    </div>
  );
}

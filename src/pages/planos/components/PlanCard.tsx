import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Plan } from "../hooks/usePlans";
import type { BillingCycle } from "./CycleToggle";

interface PlanCardProps {
  plan: Plan;
  cycle: BillingCycle;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
}

export function PlanCard({ plan, cycle }: PlanCardProps) {
  const yearly = plan.preco_anual ?? plan.preco_mensal * 12;
  const price = cycle === "yearly" ? yearly / 12 : plan.preco_mensal;
  const fullPrice = cycle === "yearly" ? yearly : plan.preco_mensal;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-8 bg-white transition-all",
        plan.destaque
          ? "border-accent-orange shadow-2xl shadow-accent-orange/10 scale-[1.02]"
          : "border-slate-200 hover:border-slate-300 hover:shadow-lg"
      )}
    >
      {plan.destaque && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-orange text-ink text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full">
          Mais popular
        </span>
      )}

      <div>
        <h3 className="text-2xl font-medium text-slate-900">{plan.nome}</h3>
        <p className="text-sm text-slate-500 mt-1">{plan.descricao}</p>
      </div>

      <div className="mt-6 mb-8">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold text-slate-900">{formatBRL(price)}</span>
          <span className="text-sm text-slate-500">/mês</span>
        </div>
        {cycle === "yearly" && <p className="text-xs text-slate-400 mt-1">Cobrado {formatBRL(fullPrice)} por ano</p>}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-slate-700">
            <Check className="w-4 h-4 text-accent-orange flex-shrink-0 mt-0.5" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        to={`/checkout?plano=${plan.slug}&ciclo=${cycle}`}
        className={cn(
          "w-full px-6 py-3 rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 group",
          plan.destaque
            ? "bg-accent-orange text-ink hover:bg-accent-orange/90"
            : "bg-ink-soft text-white hover:bg-black"
        )}
      >
        Assinar {plan.nome}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

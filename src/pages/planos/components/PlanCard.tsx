import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/currency";
import { FEATURES } from "@/lib/features";
import type { Plan } from "../hooks/usePlans";
import type { BillingCycle } from "./CycleToggle";

// A coluna `features` guarda FeatureKeys (chave estável usada em src/lib/features.ts
// pro gate real), não texto de exibição. Aqui só traduz pra rótulo amigável na vitrine.
const FEATURE_LABEL: Record<string, string> = Object.fromEntries(FEATURES.map((f) => [f.key, f.label]));

interface PlanCardProps {
  plan: Plan;
  cycle: BillingCycle;
}

export function PlanCard({ plan, cycle }: PlanCardProps) {
  const yearly = plan.preco_anual ?? plan.preco_mensal * 12;
  const price = cycle === "yearly" ? yearly / 12 : plan.preco_mensal;
  const fullPrice = cycle === "yearly" ? yearly : plan.preco_mensal;

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border p-8 bg-white transition-all",
        plan.destaque
          ? "border-brand shadow-2xl shadow-brand/10 scale-[1.02]"
          : "border-border hover:border-slate-300 hover:shadow-lg"
      )}
    >
      {plan.destaque && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-ink text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full">
          Mais popular
        </span>
      )}

      <header>
        <h3 className="text-2xl font-medium text-ink">{plan.nome}</h3>
        {plan.descricao && <p className="text-sm text-ink-muted mt-1">{plan.descricao}</p>}
      </header>

      <div className="mt-6 mb-8">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold text-ink">{formatBRL(price)}</span>
          <span className="text-sm text-ink-muted">/mês</span>
        </div>
        {cycle === "yearly" && (
          <p className="text-xs text-ink-disabled mt-1">Cobrado {formatBRL(fullPrice)} por ano</p>
        )}
        <p className="text-sm text-ink-soft font-medium mt-4">
          {plan.max_usuarios == null ? "Usuários ilimitados" : `Até ${plan.max_usuarios} usuários`}
          {" · "}
          {plan.max_projetos == null ? "projetos ilimitados" : `até ${plan.max_projetos} projetos ativos`}
        </p>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-ink-soft">
            <Check aria-hidden="true" className="w-4 h-4 text-positive-strong flex-shrink-0 mt-0.5" />
            <span>{FEATURE_LABEL[feature] ?? feature}</span>
          </li>
        ))}
      </ul>

      <Link
        to={`/checkout?plano=${plan.slug}&ciclo=${cycle}`}
        aria-label={`Assinar plano ${plan.nome}`}
        className={cn(
          "w-full px-6 py-3 rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 group",
          plan.destaque ? "bg-brand text-ink hover:bg-brand/90" : "bg-ink-soft text-white hover:bg-black"
        )}
      >
        Assinar {plan.nome}
        <ArrowRight aria-hidden="true" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </article>
  );
}

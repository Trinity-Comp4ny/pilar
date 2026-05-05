import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlans, type Plan } from "@/pages/planos/hooks/usePlans";
import { monitoring } from "@/lib/monitoring";

type BillingCycle = "monthly" | "yearly";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
}

function calculateAnnualSavings(plan: Plan): number | null {
  if (!plan.preco_anual || plan.preco_mensal <= 0) return null;
  const fullYear = plan.preco_mensal * 12;
  if (plan.preco_anual >= fullYear) return null;
  return Math.round(((fullYear - plan.preco_anual) / fullYear) * 100);
}

export function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { data: plans, isLoading, error } = usePlans();

  useEffect(() => {
    if (error) {
      monitoring.captureException(error, {
        tags: { area: "landing", section: "pricing" },
      });
    }
  }, [error]);

  // Falha silenciosa: não bloqueia a landing.
  if (error) return null;

  const hasYearlyPricing = (plans ?? []).some((p) => p.preco_anual && p.preco_anual > 0);
  const maxSavings = (plans ?? []).reduce<number>((acc, p) => {
    const s = calculateAnnualSavings(p);
    return s && s > acc ? s : acc;
  }, 0);

  return (
    <section id="planos" className="py-28 md:py-36 bg-paper scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16 reveal-up">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Planos
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              <em className="landing-highlight">Preço transparente.</em>{" "}
              <span className="italic text-ink/55">Sem fidelidade. Cancele quando quiser.</span>
            </h2>
          </div>

          {hasYearlyPricing && (
            <div className="flex justify-center mb-12 reveal-up">
              <div
                role="tablist"
                aria-label="Ciclo de cobrança"
                className="inline-flex items-center rounded-full border border-paper-border bg-white p-1 shadow-sm"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={cycle === "monthly"}
                  onClick={() => setCycle("monthly")}
                  className={cn(
                    "px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all",
                    cycle === "monthly" ? "bg-ink-soft text-white" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={cycle === "yearly"}
                  onClick={() => setCycle("yearly")}
                  className={cn(
                    "px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-2",
                    cycle === "yearly" ? "bg-ink-soft text-white" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Anual
                  {maxSavings > 0 && (
                    <span className="text-[10px] bg-brand text-ink px-1.5 py-0.5 rounded-full">-{maxSavings}%</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grid md:grid-cols-3 gap-8" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[460px] rounded-2xl border border-paper-border bg-white/40 animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && plans && plans.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-12">
              Estamos finalizando os planos. Volte em instantes.
            </p>
          )}

          {!isLoading && plans && plans.length > 0 && (
            <div className="grid md:grid-cols-3 gap-8 reveal-up">
              {plans.map((plan) => {
                const yearly = plan.preco_anual ?? plan.preco_mensal * 12;
                const monthlyEquivalent = cycle === "yearly" ? yearly / 12 : plan.preco_mensal;
                const fullPrice = cycle === "yearly" ? yearly : plan.preco_mensal;

                return (
                  <article
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl border p-8 bg-white transition-all",
                      plan.destaque
                        ? "border-brand shadow-2xl shadow-brand/10 md:scale-[1.02]"
                        : "border-paper-border hover:border-slate-300 hover:shadow-lg"
                    )}
                  >
                    {plan.destaque && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-ink text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full">
                        Mais popular
                      </span>
                    )}

                    <header>
                      <h3 className="text-2xl font-medium text-ink">{plan.nome}</h3>
                      {plan.descricao && <p className="text-sm text-slate-500 mt-1">{plan.descricao}</p>}
                    </header>

                    <div className="mt-6 mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-semibold text-ink">{formatBRL(monthlyEquivalent)}</span>
                        <span className="text-sm text-slate-500">/mês</span>
                      </div>
                      {cycle === "yearly" && (
                        <p className="text-xs text-slate-400 mt-1">Cobrado {formatBRL(fullPrice)} por ano</p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                          <Check aria-hidden="true" className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
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
                      <ArrowRight
                        aria-hidden="true"
                        className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                      />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          {!isLoading && plans && plans.length > 0 && (
            <div className="text-center mt-10">
              <Link
                to="/planos"
                className="text-sm text-ink-soft underline decoration-brand underline-offset-4 hover:text-ink transition-colors"
              >
                Ver comparação completa
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";

type BillingCycle = "monthly" | "yearly";

interface Plan {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number | null;
  max_usuarios: number | null;
  max_projetos: number | null;
  features: string[];
  destaque: boolean;
  ordem: number;
}

// Espelha os rótulos de src/lib/features.ts (FEATURES). Duplicado de propósito:
// apps/marketing não importa código do app raiz (ADR 0021). Se um rótulo mudar
// lá, replicar aqui.
const FEATURE_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  relatorios: "Relatórios",
  leads: "Leads",
  propostas: "Propostas",
  clientes: "Clientes",
  projetos: "Projetos",
  mapa: "Mapa",
  financeiro: "Financeiro",
  pessoas: "Equipe",
  metas: "Metas",
  portal_cliente: "Portal do Cliente",
  ai_chat: "Agentes",
  meu_trabalho: "Meu trabalho",
  obras: "Obras",
  ai_hub: "IA Hub",
  capacidade: "Capacidade",
  templates: "Templates",
  timesheet: "Timesheet",
};

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calculateYearlySavingPct(plan: Plan): number | null {
  if (!plan.preco_anual || plan.preco_mensal <= 0) return null;
  const fullYear = plan.preco_mensal * 12;
  if (plan.preco_anual >= fullYear) return null;
  return Math.round(((fullYear - plan.preco_anual) / fullYear) * 100);
}

// Leitura direta do REST do Supabase (sem @supabase/supabase-js): a tabela já
// tem GRANT SELECT pra anon (migration 20260507100000). Mantém apps/marketing
// sem dependência de backend, só um fetch de leitura pública. Ver ADR 0025.
function usePublicPlans() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/pilar_subscription_plans`);
    url.searchParams.set(
      "select",
      "id,slug,nome,descricao,preco_mensal,preco_anual,max_usuarios,max_projetos,features,destaque,ordem"
    );
    url.searchParams.set("ativo", "eq.true");
    url.searchParams.set("order", "ordem.asc");

    fetch(url, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data: Plan[]) => {
        if (!cancelled) setPlans(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { plans, isLoading: plans === null && !error, error };
}

function CycleToggle({
  value,
  onChange,
  yearlySavingPct,
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  yearlySavingPct?: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Ciclo de cobrança"
      className="inline-flex items-center rounded-full border border-border bg-white p-1 shadow-sm"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "monthly"}
        onClick={() => onChange("monthly")}
        className={`px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all ${
          value === "monthly" ? "bg-ink-soft text-white" : "text-ink-muted hover:text-ink"
        }`}
      >
        Mensal
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "yearly"}
        onClick={() => onChange("yearly")}
        className={`px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-2 ${
          value === "yearly" ? "bg-ink-soft text-white" : "text-ink-muted hover:text-ink"
        }`}
      >
        Anual
        {yearlySavingPct != null && yearlySavingPct > 0 && (
          <span className="text-[10px] bg-brand text-ink px-1.5 py-0.5 rounded-full">-{yearlySavingPct}%</span>
        )}
      </button>
    </div>
  );
}

function PlanCard({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  const yearly = plan.preco_anual ?? plan.preco_mensal * 12;
  const price = cycle === "yearly" ? yearly / 12 : plan.preco_mensal;
  const fullPrice = cycle === "yearly" ? yearly : plan.preco_mensal;

  return (
    <article
      className={`relative flex flex-col rounded-2xl border p-8 bg-white transition-all ${
        plan.destaque
          ? "border-brand shadow-2xl shadow-brand/10 scale-[1.02]"
          : "border-border hover:border-slate-300 hover:shadow-lg"
      }`}
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
        {cycle === "yearly" && <p className="text-xs text-ink-disabled mt-1">Cobrado {formatBRL(fullPrice)} por ano</p>}
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

      <a
        href={`${APP_URL}/checkout?plano=${plan.slug}&ciclo=${cycle}`}
        onClick={() => trackCta("assinar_plano", `planos_${plan.slug}`)}
        aria-label={`Assinar plano ${plan.nome}`}
        className={`w-full px-6 py-3 rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 group ${
          plan.destaque ? "bg-brand text-ink hover:bg-brand/90" : "bg-ink-soft text-white hover:bg-black"
        }`}
      >
        Assinar {plan.nome}
        <ArrowRight aria-hidden="true" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </a>
    </article>
  );
}

function EnterpriseCard() {
  const subject = encodeURIComponent("Contato comercial: ENTERPRISE");
  return (
    <article className="relative flex flex-col rounded-2xl border border-border p-8 bg-paper-alt">
      <header>
        <h3 className="text-2xl font-medium text-ink">Enterprise</h3>
        <p className="text-sm text-ink-muted mt-1">Pra operação completa, sob consulta</p>
      </header>

      <div className="mt-6 mb-8">
        <span className="text-2xl font-semibold text-ink">Sob consulta</span>
        <p className="text-sm text-ink-soft font-medium mt-4">Usuários e projetos ilimitados</p>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        <li className="text-sm text-ink-soft">Tudo do Escala</li>
        <li className="text-sm text-ink-soft">Implantação assistida</li>
        <li className="text-sm text-ink-soft">Suporte dedicado</li>
      </ul>

      <a
        href={`mailto:comercial@pilarsoft.com.br?subject=${subject}`}
        onClick={() => trackCta("falar_comercial", "planos_enterprise")}
        className="w-full px-6 py-3 rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 group bg-ink-soft text-white hover:bg-black"
      >
        Falar com o comercial
        <ArrowRight aria-hidden="true" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </a>
    </article>
  );
}

function PlanSkeleton() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[460px] rounded-2xl border border-border bg-white/40 animate-pulse" />
      ))}
    </div>
  );
}

export function Planos() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { plans, isLoading, error } = usePublicPlans();

  useEffect(() => {
    document.title = "Planos | Pilar";
  }, []);

  const maxSavings = (plans ?? []).reduce<number>((acc, p) => {
    const s = calculateYearlySavingPct(p);
    return s != null && s > acc ? s : acc;
  }, 0);

  return (
    <>
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[600px] bg-brand/7 rounded-full blur-[130px] animate-aurora" />
          <div className="absolute top-1/4 right-0 w-[500px] h-[400px] bg-blue-400/5 rounded-full blur-[100px] animate-aurora-alt" />
          <div className="absolute inset-0 hero-dot-grid" />
        </div>

        <div className="container mx-auto px-6 md:px-10 text-center">
          <div className="mb-6">
            <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
              Planos
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.05] mb-6 text-ink">
            Escolha seu plano.
            <br />
            <em className="landing-highlight">Ative em minutos.</em>
          </h1>
          <p className="text-ink-muted text-lg max-w-2xl mx-auto font-light mb-10">
            Pague por cartão, PIX ou boleto. Sem fidelidade. Cancele quando quiser.
          </p>
          <CycleToggle value={cycle} onChange={setCycle} yearlySavingPct={maxSavings || undefined} />
        </div>
      </section>

      <section className="container mx-auto px-6 md:px-10 pb-24">
        {isLoading && <PlanSkeleton />}

        {error && (
          <div className="max-w-md mx-auto p-6 bg-danger-soft border border-danger-mid-border rounded-xl text-center text-sm text-danger-strong">
            Não foi possível carregar os planos. Tente novamente em instantes.
          </div>
        )}

        {!isLoading && !error && plans?.length === 0 && (
          <p className="text-center text-sm text-ink-disabled py-12">
            Estamos finalizando os planos. Volte em instantes.
          </p>
        )}

        {plans && plans.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} cycle={cycle} />
            ))}
            <EnterpriseCard />
          </div>
        )}
      </section>
    </>
  );
}

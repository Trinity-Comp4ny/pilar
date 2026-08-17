import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LandingHeader } from "@/pages/landing/components/LandingHeader";
import { LandingFooter } from "@/pages/landing/components/LandingFooter";
import { FalarComercialDialog } from "@/components/admin/FalarComercialDialog";
import { usePlans, calculateYearlySavingPct } from "./hooks/usePlans";
import { PlanCard } from "./components/PlanCard";
import { CycleToggle, type BillingCycle } from "./components/CycleToggle";

function PlanSkeleton() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[460px] rounded-2xl border border-border bg-white/40 animate-pulse" />
      ))}
    </div>
  );
}

function EnterpriseCard({ onContact }: { onContact: () => void }) {
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

      <button
        type="button"
        onClick={onContact}
        className="w-full px-6 py-3 rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 group bg-ink-soft text-white hover:bg-black"
      >
        Falar com o comercial
        <ArrowRight aria-hidden="true" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </article>
  );
}

export default function Planos() {
  usePageTitle("Planos");
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [contactOpen, setContactOpen] = useState(false);
  const { data: plans, isLoading, error } = usePlans();

  const maxSavings = (plans ?? []).reduce<number>((acc, p) => {
    const s = calculateYearlySavingPct(p);
    return s != null && s > acc ? s : acc;
  }, 0);

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate("/");
  };

  return (
    <div className="landing-grain min-h-screen bg-paper text-ink-soft font-sans selection:bg-brand/30 selection:text-ink">
      <LandingHeader onScrollToTop={scrollToTop} />

      <div className="pt-[88px]">
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

          {!isLoading && plans?.length === 0 && (
            <p className="text-center text-sm text-ink-disabled py-12">
              Estamos finalizando os planos. Volte em instantes.
            </p>
          )}

          {plans && plans.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} cycle={cycle} />
              ))}
              <EnterpriseCard onContact={() => setContactOpen(true)} />
            </div>
          )}
        </section>

        <div className="pb-12" />
      </div>

      <LandingFooter />
      <FalarComercialDialog open={contactOpen} onOpenChange={setContactOpen} currentPlan="enterprise-sob-consulta" />
    </div>
  );
}

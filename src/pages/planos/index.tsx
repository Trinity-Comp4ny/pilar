import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePlans } from "./hooks/usePlans";
import { PlanCard } from "./components/PlanCard";
import { CycleToggle, type BillingCycle } from "./components/CycleToggle";

export default function Planos() {
  usePageTitle("Planos");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { data: plans, isLoading, error } = usePlans();

  return (
    <div className="min-h-screen bg-paper text-ink-soft">
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-paper-border">
        <div className="container mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-500 hover:text-accent-orange transition-colors text-sm font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Voltar
          </Link>
          <span className="text-xl font-medium tracking-tight">
            Pilar<sup className="text-[9px] font-normal text-slate-400 ml-0.5 relative -top-2">®</sup>
          </span>
          <Link
            to="/login"
            className="text-xs uppercase tracking-wider text-slate-500 hover:text-accent-orange transition-colors"
          >
            Já tenho conta
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-6 md:px-10 pt-20 pb-12 text-center">
        <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.05] mb-6">
          Escolha seu plano.
          <br />
          <span className="text-slate-400">Ative em minutos.</span>
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto font-light mb-10">
          Pague por cartão, PIX ou boleto. Sem fidelidade. Cancele quando quiser.
        </p>
        <CycleToggle value={cycle} onChange={setCycle} />
      </section>

      <section className="container mx-auto px-6 md:px-10 pb-24">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
            Não foi possível carregar os planos. Tente novamente em instantes.
          </div>
        )}

        {plans && plans.length > 0 && (
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} cycle={cycle} />
            ))}
          </div>
        )}
      </section>

      <footer className="container mx-auto px-6 md:px-10 pb-16 text-center text-xs text-slate-400">
        Pagamentos processados por Asaas. Todos os preços em BRL.
      </footer>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePlans } from "@/pages/planos/hooks/usePlans";
import type { BillingCycle } from "@/pages/planos/components/CycleToggle";
import { CheckoutForm } from "./components/CheckoutForm";
import { PixPayment } from "./components/PixPayment";
import { BoletoPayment } from "./components/BoletoPayment";
import { PaymentSuccess } from "./components/PaymentSuccess";
import { useCheckoutCreate, type CheckoutResponse } from "./hooks/useCheckoutCreate";
import { useCheckoutStatus } from "./hooks/useCheckoutStatus";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Checkout() {
  usePageTitle("Checkout");
  const [params] = useSearchParams();
  const planSlug = params.get("plano") ?? "";
  const cycle: BillingCycle = params.get("ciclo") === "yearly" ? "yearly" : "monthly";

  const { data: plans, isLoading: loadingPlans } = usePlans();
  const plan = useMemo(() => plans?.find((p) => p.slug === planSlug), [plans, planSlug]);

  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null);
  const createCheckout = useCheckoutCreate();

  const { data: status } = useCheckoutStatus(
    checkoutResult?.session_token ?? null,
    !!checkoutResult && checkoutResult.billing_type !== "CREDIT_CARD"
  );

  const effectiveStatus = status?.payment_status ?? checkoutResult?.payment_status ?? null;
  const inviteDispatched = status?.invite_dispatched ?? false;

  if (!planSlug) {
    return <Navigate to="/planos" replace />;
  }

  if (loadingPlans) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!plan) {
    return <Navigate to="/planos" replace />;
  }

  const planValue = cycle === "yearly" ? (plan.preco_anual ?? plan.preco_mensal * 12) : plan.preco_mensal;

  return (
    <div className="min-h-screen bg-paper text-ink-soft">
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-paper-border">
        <div className="container mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <Link
            to="/planos"
            className="flex items-center gap-2 text-slate-500 hover:text-brand transition-colors text-sm font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Voltar aos planos
          </Link>
          <span className="text-xl font-medium tracking-tight">
            Pilar<sup className="text-[9px] font-normal text-slate-400 ml-0.5 relative -top-2">®</sup>
          </span>
          <span className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-10 py-12 max-w-5xl">
        <div className="grid lg:grid-cols-[1fr_380px] gap-10">
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            {effectiveStatus === "paid" ? (
              <PaymentSuccess
                email={checkoutResult?.plan && status?.email ? status.email : ""}
                planNome={plan.nome}
                inviteDispatched={inviteDispatched}
              />
            ) : checkoutResult?.billing_type === "PIX" && checkoutResult.metadata.pix ? (
              <PixPayment
                encodedImage={checkoutResult.metadata.pix.encoded_image}
                payload={checkoutResult.metadata.pix.payload}
                expirationDate={checkoutResult.metadata.pix.expiration_date}
                value={checkoutResult.metadata.value}
                isPolling={effectiveStatus === "pending"}
              />
            ) : checkoutResult?.billing_type === "BOLETO" && checkoutResult.metadata.boleto ? (
              <BoletoPayment
                bankSlipUrl={checkoutResult.metadata.boleto.bank_slip_url}
                identificationField={checkoutResult.metadata.boleto.identification_field}
                value={checkoutResult.metadata.value}
                isPolling={effectiveStatus === "pending"}
              />
            ) : (
              <CheckoutForm
                planSlug={plan.slug}
                planNome={plan.nome}
                planValue={planValue}
                cycle={cycle}
                onSubmit={(payload) => {
                  createCheckout.mutate(payload, {
                    onSuccess: (data) => setCheckoutResult(data),
                  });
                }}
                isSubmitting={createCheckout.isPending}
                errorMessage={createCheckout.error ? (createCheckout.error as Error).message : null}
              />
            )}
          </section>

          <aside className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-fit sticky top-28">
            <h3 className="text-xs uppercase tracking-wider text-slate-400 mb-4">Resumo</h3>

            <div className="space-y-3 pb-4 border-b border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-900">Pilar {plan.nome}</p>
                  <p className="text-xs text-slate-500">
                    {cycle === "yearly" ? "Assinatura anual" : "Assinatura mensal"}
                  </p>
                </div>
                <p className="text-sm font-medium text-slate-900">{formatBRL(planValue)}</p>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-baseline">
              <span className="text-xs uppercase tracking-wider text-slate-500">Total</span>
              <div className="text-right">
                <p className="text-2xl font-semibold text-slate-900">{formatBRL(planValue)}</p>
                <p className="text-[11px] text-slate-400">{cycle === "yearly" ? "por ano" : "por mês"}</p>
              </div>
            </div>

            <ul className="mt-6 space-y-2 text-xs text-slate-500">
              <li>✓ Sem fidelidade, cancele quando quiser</li>
              <li>✓ Nota fiscal emitida automaticamente</li>
              <li>✓ Suporte por email</li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}

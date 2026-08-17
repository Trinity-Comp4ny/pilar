import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
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

  if (!planSlug) return <Navigate to="/planos" replace />;

  if (loadingPlans) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ink-disabled" />
      </div>
    );
  }

  if (!plan) return <Navigate to="/planos" replace />;

  const planValue = cycle === "yearly" ? (plan.preco_anual ?? plan.preco_mensal * 12) : plan.preco_mensal;

  return (
    <div className="landing-grain min-h-screen bg-paper text-ink-soft font-sans">
      {/* Fundo aurora suave */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-brand/5 rounded-full blur-[120px]" />
      </div>

      {/* Header mínimo */}
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-paper-border">
        <div className="container mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <Link
            to="/planos"
            className="flex items-center gap-2 text-ink-muted hover:text-brand transition-colors text-sm font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Voltar
          </Link>

          <a href="/" className="flex items-center gap-2 group">
            <img
              src="/pilar-logo.svg"
              alt="Pilar"
              className="h-7 w-auto transition-transform duration-500 group-hover:rotate-12"
            />
            <span className="text-lg font-medium tracking-tight text-ink-soft">
              Pilar<sup className="text-[9px] font-normal text-ink-disabled ml-0.5 relative -top-2">®</sup>
            </span>
          </a>

          <div className="flex items-center gap-1 text-[11px] text-ink-disabled">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Checkout seguro</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-10 py-10 max-w-5xl">
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* Formulário */}
          <section className="bg-white rounded-2xl border border-paper-border p-8 shadow-sm">
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

          {/* Resumo sticky */}
          <aside className="sticky top-[73px] space-y-4">
            <div className="bg-white rounded-2xl border border-paper-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] uppercase tracking-widest text-ink-disabled">Resumo do pedido</p>
                <Link
                  to="/planos"
                  className="flex items-center gap-1 text-[11px] text-ink-soft hover:text-ink transition-colors font-medium"
                >
                  Trocar plano <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <p className="font-semibold text-ink">Pilar {plan.nome}</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {cycle === "yearly" ? "Assinatura anual" : "Assinatura mensal"}
                  </p>
                  {plan.descricao && <p className="text-xs text-ink-disabled mt-1">{plan.descricao}</p>}
                </div>
                <p className="text-sm font-semibold text-ink whitespace-nowrap">{formatBRL(planValue)}</p>
              </div>

              {plan.features.length > 0 && (
                <ul className="mt-4 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-xs text-ink-muted">
                      <Check className="w-3.5 h-3.5 text-positive-strong flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 pt-4 border-t border-border flex justify-between items-baseline">
                <span className="text-xs uppercase tracking-wider text-ink-muted">Total</span>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-ink">{formatBRL(planValue)}</p>
                  <p className="text-[11px] text-ink-disabled">{cycle === "yearly" ? "por ano" : "por mês"}</p>
                </div>
              </div>
            </div>

            {/* Trust signals */}
            <div className="bg-white rounded-xl border border-paper-border p-4 space-y-2.5">
              {[
                "Sem fidelidade — cancele quando quiser",
                "Nota fiscal emitida automaticamente",
                "Acesso imediato após confirmação",
                "Suporte por email incluso",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-ink-muted">
                  <ShieldCheck className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

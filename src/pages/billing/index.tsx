import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Calendar, Package, ExternalLink, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useUserRole } from "@/hooks/useUserRole";
import { useMySubscription } from "./hooks/useMySubscription";
import { StatusBadge } from "./components/StatusBadge";
import { ChangePlanDialog } from "./components/ChangePlanDialog";
import { CancelDialog } from "./components/CancelDialog";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const BILLING_TYPE_LABELS: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  PIX: "PIX",
  BOLETO: "Boleto",
  UNDEFINED: "A definir",
};

export default function Billing() {
  usePageTitle("Assinatura");
  const navigate = useNavigate();
  const { data: role } = useUserRole();
  const isAdmin = role === "admin" || role === "ultra_admin";

  const { data: subscription, isLoading, error } = useMySubscription();
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const isCanceled = subscription?.status === "canceled";
  const isOverdue = subscription?.status === "overdue";

  const value =
    subscription?.plan && subscription.billing_cycle === "yearly"
      ? subscription.plan.preco_anual
      : subscription?.plan?.preco_mensal;

  return (
    <PageLayout>
      <PageHeader title="Assinatura" />

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Erro ao carregar assinatura. Tente recarregar.
        </div>
      )}

      {!isLoading && !subscription && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-slate-900">Sem assinatura ativa</h3>
              <p className="text-sm text-slate-500 mt-1">Escolha um plano pra começar a usar o Pilar.</p>
            </div>
            <Button onClick={() => navigate("/planos")} variant="brand">
              Ver planos
            </Button>
          </CardContent>
        </Card>
      )}

      {subscription && subscription.plan && (
        <div className="space-y-6">
          {isOverdue && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <strong>Pagamento em atraso.</strong> Regularize a última cobrança pra manter o acesso liberado.
            </div>
          )}

          {isCanceled && (
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-700">
              <strong>Assinatura cancelada.</strong> Acesso mantido até {formatDate(subscription.current_period_end)}.
            </div>
          )}

          <div className="grid md:grid-cols-[1.5fr_1fr] gap-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">Plano atual</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">{subscription.plan.descricao}</p>
                </div>
                <StatusBadge status={subscription.status} />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold text-slate-900">Pilar {subscription.plan.nome}</span>
                </div>

                <div className="flex items-baseline gap-2 pb-6 border-b border-slate-100">
                  <span className="text-3xl font-semibold text-slate-900">{value ? formatBRL(value) : "—"}</span>
                  <span className="text-sm text-slate-500">
                    /{subscription.billing_cycle === "yearly" ? "ano" : "mês"}
                  </span>
                </div>

                <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Forma de pagamento
                    </dt>
                    <dd className="text-slate-900 font-medium">
                      {BILLING_TYPE_LABELS[subscription.billing_type ?? ""] ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Próxima cobrança
                    </dt>
                    <dd className="text-slate-900 font-medium">
                      {isCanceled ? "—" : formatDate(subscription.current_period_end)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-slate-400 mb-1">Período atual</dt>
                    <dd className="text-slate-900">
                      {formatDate(subscription.current_period_start)} → {formatDate(subscription.current_period_end)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-slate-400 mb-1">Cliente desde</dt>
                    <dd className="text-slate-900">{formatDate(subscription.created_at)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isAdmin ? (
                  <>
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      disabled={isCanceled}
                      onClick={() => setChangeOpen(true)}
                    >
                      <Package className="w-4 h-4 mr-2" /> Mudar plano
                    </Button>
                    <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/planos")}>
                      <ExternalLink className="w-4 h-4 mr-2" /> Ver todos os planos
                    </Button>
                    <Button
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      variant="outline"
                      disabled={isCanceled}
                      onClick={() => setCancelOpen(true)}
                    >
                      Cancelar assinatura
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Apenas o admin da empresa pode gerenciar a assinatura.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">O que está incluso</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                {subscription.plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {isAdmin && (
            <>
              <ChangePlanDialog open={changeOpen} onOpenChange={setChangeOpen} current={subscription} />
              <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} current={subscription} />
            </>
          )}
        </div>
      )}
    </PageLayout>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Calendar, Package, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import { useMySubscription } from "@/pages/billing/hooks/useMySubscription";
import { StatusBadge } from "@/pages/billing/components/StatusBadge";
import { ChangePlanDialog } from "@/pages/billing/components/ChangePlanDialog";
import { CancelDialog } from "@/pages/billing/components/CancelDialog";
import { useSettingsModal } from "@/contexts/SettingsModalContext";

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

// Conteúdo da aba Pagamento do modal (antigo /billing sem a casca de página). O
// acesso NÃO passa por step-up de MFA aqui de propósito: é a rota de fuga do cliente
// inadimplente para regularizar a assinatura. Ações destrutivas seguem só-admin.
export function PagamentoPanel() {
  const navigate = useNavigate();
  const { closeSettings } = useSettingsModal();
  const { data: role } = useUserRole();
  const isAdmin = role === "admin" || role === "ultra_admin";

  const { data: subscription, isLoading, error } = useMySubscription();
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const isCanceled = subscription?.status === "canceled";
  const isOverdue = subscription?.status === "overdue";

  const goToPlanos = () => {
    closeSettings();
    navigate("/planos");
  };

  const value =
    subscription?.plan && subscription.billing_cycle === "yearly"
      ? subscription.plan.preco_anual
      : subscription?.plan?.preco_mensal;

  return (
    <>
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-ink-disabled" />
        </div>
      )}

      {error && (
        <div className="p-6 bg-danger-soft border border-danger-mid-border rounded-xl text-sm text-danger-strong">
          Erro ao carregar assinatura. Tente recarregar.
        </div>
      )}

      {!isLoading && !subscription && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Package className="w-10 h-10 text-ink-disabled mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-ink">Sem assinatura ativa</h3>
              <p className="text-sm text-ink-muted mt-1">Escolha um plano pra começar a usar o Pilar.</p>
            </div>
            <Button onClick={goToPlanos} variant="brand">
              Ver planos
            </Button>
          </CardContent>
        </Card>
      )}

      {subscription && subscription.plan && (
        <div className="space-y-6">
          {isOverdue && (
            <div className="p-4 bg-warning-soft border border-warning-mid-border rounded-xl text-sm text-warning-strong">
              <strong>Pagamento em atraso.</strong> Regularize a última cobrança pra manter o acesso liberado.
            </div>
          )}

          {isCanceled && (
            <div className="p-4 bg-muted border border-border rounded-xl text-sm text-ink-soft">
              <strong>Assinatura cancelada.</strong> Acesso mantido até {formatDate(subscription.current_period_end)}.
            </div>
          )}

          <div className="grid md:grid-cols-[1.5fr_1fr] gap-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">Plano atual</CardTitle>
                  <p className="text-sm text-ink-muted mt-1">{subscription.plan.descricao}</p>
                </div>
                <StatusBadge status={subscription.status} />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold text-ink">Pilar {subscription.plan.nome}</span>
                </div>

                <div className="flex items-baseline gap-2 pb-6 border-b border-border">
                  <span className="text-3xl font-semibold text-ink">{value ? formatBRL(value) : "—"}</span>
                  <span className="text-sm text-ink-muted">
                    /{subscription.billing_cycle === "yearly" ? "ano" : "mês"}
                  </span>
                </div>

                <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-ink-disabled mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Forma de pagamento
                    </dt>
                    <dd className="text-ink font-medium">
                      {BILLING_TYPE_LABELS[subscription.billing_type ?? ""] ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-ink-disabled mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Próxima cobrança
                    </dt>
                    <dd className="text-ink font-medium">
                      {isCanceled ? "—" : formatDate(subscription.current_period_end)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-ink-disabled mb-1">Período atual</dt>
                    <dd className="text-ink">
                      {formatDate(subscription.current_period_start)} → {formatDate(subscription.current_period_end)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-ink-disabled mb-1">Cliente desde</dt>
                    <dd className="text-ink">{formatDate(subscription.created_at)}</dd>
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
                    <Button className="w-full justify-start" variant="outline" onClick={goToPlanos}>
                      <ExternalLink className="w-4 h-4 mr-2" /> Ver todos os planos
                    </Button>
                    <Button
                      className="w-full justify-start text-danger-mid hover:text-danger-strong hover:bg-danger-soft"
                      variant="outline"
                      disabled={isCanceled}
                      onClick={() => setCancelOpen(true)}
                    >
                      Cancelar assinatura
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">Apenas o admin da empresa pode gerenciar a assinatura.</p>
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
                  <li key={feature} className="flex items-center gap-2 text-ink-soft">
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
    </>
  );
}

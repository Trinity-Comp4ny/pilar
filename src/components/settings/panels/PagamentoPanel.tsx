import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Calendar, Package, ExternalLink, Sparkles, Lock, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import { useMySubscription } from "@/pages/billing/hooks/useMySubscription";
import { StatusBadge } from "@/pages/billing/components/StatusBadge";
import { ChangePlanDialog } from "@/pages/billing/components/ChangePlanDialog";
import { CancelDialog } from "@/pages/billing/components/CancelDialog";
import { AtivarPlano } from "@/components/trial/AtivarPlano";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { MARKETING_URL } from "@/lib/marketingSite";
import { ehConvidada, podeAtivarPlano } from "@/lib/cobranca";

import { ReadingRing } from "@/components/motion/ReadingRing";

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
  const { closeSettings } = useSettingsModal();
  const { data: role } = useUserRole();
  const isAdmin = role === "admin" || role === "ultra_admin";

  const qc = useQueryClient();
  const { data: subscription, isLoading, error } = useMySubscription();
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [ativarOpen, setAtivarOpen] = useState(false);

  const isCanceled = subscription?.status === "canceled";
  const isOverdue = subscription?.status === "overdue";
  const isTrialing = subscription?.status === "trialing";
  const isExpired = subscription?.status === "expired";
  // SPEC 104: convidada não paga; sem assinatura também conta (empresas antigas).
  const convidada = !isLoading && !error && ehConvidada(subscription);

  const goToPlanos = () => {
    closeSettings();
    window.location.href = `${MARKETING_URL}/planos`;
  };

  const value =
    subscription?.plan && subscription.billing_cycle === "yearly"
      ? subscription.plan.preco_anual
      : subscription?.plan?.preco_mensal;

  return (
    <>
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <ReadingRing size={64} />
        </div>
      )}

      {error && (
        <div className="p-6 bg-danger-soft border border-danger-mid-border rounded-xl text-sm text-danger-strong">
          Erro ao carregar assinatura. Tente recarregar.
        </div>
      )}

      {convidada && (
        <Card>
          <CardContent className="py-10 space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-brand/10 shrink-0">
                <Handshake className="w-6 h-6 text-ink" />
              </div>
              <div className="space-y-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider bg-brand text-ink">
                  Empresa convidada
                </span>
                <h3 className="text-lg font-medium text-ink">
                  {subscription?.plan ? `Pilar ${subscription.plan.nome}, sem cobrança` : "Acesso sem cobrança"}
                </h3>
                <p className="text-sm text-ink-muted">
                  Sua empresa usa o Pilar a convite, sem mensalidade. Se o convite acabar, você recebe um prazo e um
                  aviso antes de qualquer cobrança.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!convidada && subscription && subscription.plan && (
        <div className="space-y-6">
          {isOverdue && (
            <div className="p-4 bg-warning-soft border border-warning-mid-border rounded-xl text-sm text-warning-strong">
              <strong>Pagamento em atraso.</strong> Regularize a última cobrança pra manter o acesso liberado.
            </div>
          )}

          {isCanceled && (
            <div className="p-4 bg-muted border border-border rounded-xl text-sm text-ink-soft flex items-start gap-3">
              <div className="flex-1">
                <strong>Assinatura cancelada.</strong> Os dados continuam guardados.{" "}
                {isAdmin
                  ? "Assine de novo para voltar a usar."
                  : "Peça ao administrador da empresa para assinar de novo."}
              </div>
              {isAdmin && (
                <Button variant="brand" size="sm" onClick={() => setAtivarOpen(true)}>
                  Assinar de novo
                </Button>
              )}
            </div>
          )}

          {isExpired && (
            <div className="p-4 bg-warning-soft border border-warning-mid-border rounded-xl text-sm text-warning-strong flex items-start gap-3">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong>Seu teste terminou.</strong>{" "}
                {isAdmin
                  ? "Os dados continuam guardados. Assine para voltar a editar na hora."
                  : "Os dados continuam guardados. Peça ao administrador da empresa para assinar."}
              </div>
              {isAdmin && (
                <Button variant="brand" size="sm" onClick={() => setAtivarOpen(true)}>
                  Assinar agora
                </Button>
              )}
            </div>
          )}

          {isTrialing && isAdmin && (
            <div className="p-4 bg-brand/5 border border-brand/20 rounded-xl text-sm text-ink-soft flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="text-ink">Você está no teste grátis.</strong> Ative o plano agora e não perca acesso
                quando o teste terminar em {formatDate(subscription.trial_ends_at)}: nada é cobrado até lá.
              </div>
              <Button variant="brand" size="sm" onClick={() => setAtivarOpen(true)}>
                Ativar plano
              </Button>
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
                      disabled={isCanceled || isTrialing || isExpired}
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
                      disabled={isCanceled || isTrialing || isExpired}
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
              {podeAtivarPlano(subscription) && (
                <AtivarPlano
                  open={ativarOpen}
                  onOpenChange={setAtivarOpen}
                  subscription={subscription}
                  onAtivado={() => {
                    // Saiu do modo leitura: o gate e o banner leem status/leitura_desde.
                    void qc.invalidateQueries({ queryKey: ["pilar-my-subscription"] });
                    void qc.invalidateQueries({ queryKey: ["trial-subscription"] });
                    if (isExpired || isCanceled) window.location.reload();
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

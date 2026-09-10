import { useState } from "react";
import { NavLink } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, Inbox, Clock, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AditivoReviewCard } from "@/components/AditivoReviewCard";
import {
  usePendenciasAgentes,
  useAprovarEscopo,
  useRejeitarEscopo,
  useAdiarEscopo,
  type PendenciaAditivo,
} from "@/hooks/useEscopos";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAgentHeartbeat } from "@/hooks/useAgentHeartbeat";
import { formatDateTime } from "@/lib/format";

const HEARTBEAT_STALE_HORAS = 30; // roda diariamente às 06:15 UTC; folga sobre 24h pra não alarmar à toa

/**
 * Aba "Pendências" de /agentes (spec 084): tudo que um agente preparou e está
 * esperando decisão humana, de qualquer projeto — hoje só aditivos (guardião de
 * margem, spec 081, e criados manualmente pelo chat). Mesma fonte que a aba
 * Escopo de cada projeto lê; aprovar/rejeitar aqui reflete lá sem reload.
 */
export function PendenciasTab() {
  const pendencias = usePendenciasAgentes();
  const aprovar = useAprovarEscopo();
  const rejeitar = useRejeitarEscopo();
  const adiar = useAdiarEscopo();
  const heartbeat = useAgentHeartbeat("guardiao_margem_cron");
  const { canEdit } = useFeatureAccess("projetos");

  const [confirmAprovar, setConfirmAprovar] = useState<PendenciaAditivo | null>(null);
  const [confirmRejeitar, setConfirmRejeitar] = useState<PendenciaAditivo | null>(null);

  const handleAdiar = async (escopoId: string, dias: number) => {
    try {
      await adiar.mutateAsync({ escopoId, dias });
      toast.success(dias === 1 ? "Adiado por 1 dia" : `Adiado por ${dias} dias`);
    } catch {
      toast.error("Não foi possível adiar");
    }
  };

  const heartbeatData = heartbeat.data;
  const heartbeatStale =
    !heartbeat.isLoading &&
    (!heartbeatData ||
      Date.now() - new Date(heartbeatData.last_run_at).getTime() > HEARTBEAT_STALE_HORAS * 60 * 60 * 1000);

  const handleAprovar = async () => {
    if (!confirmAprovar) return;
    try {
      await aprovar.mutateAsync({ escopoId: confirmAprovar.id, projetoId: confirmAprovar.projeto_id });
      toast.success("Aditivo aprovado — contrato e orçamento atualizados");
      setConfirmAprovar(null);
    } catch {
      toast.error("Não foi possível aprovar o aditivo");
    }
  };

  const handleRejeitar = async () => {
    if (!confirmRejeitar) return;
    try {
      await rejeitar.mutateAsync({ escopoId: confirmRejeitar.id, projetoId: confirmRejeitar.projeto_id });
      toast.success("Aditivo rejeitado");
      setConfirmRejeitar(null);
    } catch {
      toast.error("Não foi possível rejeitar o aditivo");
    }
  };

  if (pendencias.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const itens = pendencias.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
      {!heartbeat.isLoading &&
        (heartbeatStale ? (
          <div className="flex items-start gap-2 rounded-xl border border-warning-mid-border bg-warning-soft p-3 text-sm text-warning-strong">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Guardião de margem sem sinal de execução recente: pode estar com problema, não necessariamente "nenhum
              projeto estourou". Se persistir, avise o suporte.
            </p>
          </div>
        ) : (
          heartbeatData && (
            <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Guardião de margem: última verificação {formatDateTime(heartbeatData.last_run_at)}
              {typeof heartbeatData.detail?.encontrados === "number" &&
                ` · viu ${heartbeatData.detail.encontrados} projeto(s), criou ${heartbeatData.detail.criados ?? 0}`}
            </p>
          )
        ))}

      {itens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nada esperando decisão agora</p>
            <p className="text-sm text-muted-foreground">
              Quando um agente preparar um aditivo — sugerido pelo guardião de margem ou criado por alguém no chat — ele
              aparece aqui até ser aprovado ou rejeitado.
            </p>
          </CardContent>
        </Card>
      ) : (
        itens.map((escopo) => (
          <div key={escopo.id} className="space-y-1.5">
            <AditivoReviewCard
              escopo={escopo}
              canEdit={canEdit}
              projetoNome={escopo.projeto_nome}
              onAprovar={() => setConfirmAprovar(escopo)}
              onRejeitar={() => setConfirmRejeitar(escopo)}
            />
            <div className="flex items-center justify-between pl-1">
              <NavLink
                to={`/projetos/${escopo.projeto_id}#escopo`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Ver na aba Escopo do projeto <ArrowUpRight className="h-3 w-3" />
              </NavLink>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> Adiar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleAdiar(escopo.id, 3)}>Por 3 dias</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAdiar(escopo.id, 7)}>Por 1 semana</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))
      )}

      <ConfirmDialog
        open={!!confirmAprovar}
        onOpenChange={(open) => !open && setConfirmAprovar(null)}
        onConfirm={handleAprovar}
        title="Aprovar aditivo"
        itemName={confirmAprovar?.descricao}
        description="O valor entra no contrato do projeto e no orçamento vivo imediatamente. Esta ação não pode ser desfeita pela tela."
        confirmText="Aprovar"
        variant="default"
        loading={aprovar.isPending}
      />
      <ConfirmDialog
        open={!!confirmRejeitar}
        onOpenChange={(open) => !open && setConfirmRejeitar(null)}
        onConfirm={handleRejeitar}
        title="Rejeitar aditivo"
        itemName={confirmRejeitar?.descricao}
        description="O rascunho é descartado. Contrato e orçamento não são alterados."
        confirmText="Rejeitar"
        variant="destructive"
        loading={rejeitar.isPending}
      />
    </div>
  );
}

import { useState } from "react";
import { NavLink } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AditivoReviewCard } from "@/components/AditivoReviewCard";
import { usePendenciasAgentes, useAprovarEscopo, useRejeitarEscopo, type PendenciaAditivo } from "@/hooks/useEscopos";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

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
  const { canEdit } = useFeatureAccess("projetos");

  const [confirmAprovar, setConfirmAprovar] = useState<PendenciaAditivo | null>(null);
  const [confirmRejeitar, setConfirmRejeitar] = useState<PendenciaAditivo | null>(null);

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
      {itens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nada esperando decisão agora</p>
            <p className="text-sm text-muted-foreground">
              Quando um agente preparar um aditivo — sugerido pelo guardião de margem ou criado
              por alguém no chat — ele aparece aqui até ser aprovado ou rejeitado.
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
            <NavLink
              to={`/projetos/${escopo.projeto_id}#escopo`}
              className="inline-flex items-center gap-1 pl-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Ver na aba Escopo do projeto <ArrowUpRight className="h-3 w-3" />
            </NavLink>
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

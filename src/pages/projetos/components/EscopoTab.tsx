import { useState } from "react";
import { Sparkles, User, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { KPICard } from "@/components/KPICard";
import { formatCurrency, formatDate } from "@/lib/format";
import { useEscopos, useOrcamentoVivo, useAprovarEscopo, useRejeitarEscopo, type EscopoRow } from "@/hooks/useEscopos";

interface EscopoTabProps {
  projetoId: string;
  canEdit: boolean;
}

const STATUS_ATIVOS = ["rascunho", "pendente_aprovacao"];

function AditivoCard({
  escopo,
  canEdit,
  onAprovar,
  onRejeitar,
}: {
  escopo: EscopoRow;
  canEdit: boolean;
  onAprovar: () => void;
  onRejeitar: () => void;
}) {
  const isPendente = STATUS_ATIVOS.includes(escopo.status ?? "");
  const origemAgente = escopo.created_by === null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{escopo.descricao}</p>
              <StatusBadge domain="escopo" status={escopo.status ?? "rascunho"} />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {origemAgente ? (
                <>
                  <Sparkles className="h-3 w-3" /> Sugerido pelo agente
                </>
              ) : (
                <>
                  <User className="h-3 w-3" /> Criado manualmente
                </>
              )}
              {" · "}
              {formatDate(escopo.created_at ?? undefined)}
            </p>
          </div>
          <p className="whitespace-nowrap text-sm font-medium text-foreground">
            {formatCurrency(escopo.valor_aditivo ?? 0)}
          </p>
        </div>

        {escopo.justificativa && <p className="text-sm text-muted-foreground">{escopo.justificativa}</p>}

        {escopo.escopo_itens.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {escopo.escopo_itens.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span>
                  {item.descricao}
                  {item.disciplina ? ` (${item.disciplina})` : ""}
                </span>
                <span className="whitespace-nowrap">{formatCurrency(item.custo ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}

        {isPendente && canEdit && (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={onRejeitar}>
              Rejeitar
            </Button>
            <Button variant="brand" size="sm" onClick={onAprovar}>
              Aprovar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EscopoTab({ projetoId, canEdit }: EscopoTabProps) {
  const escopos = useEscopos(projetoId);
  const orcamentoVivo = useOrcamentoVivo(projetoId);
  const aprovar = useAprovarEscopo(projetoId);
  const rejeitar = useRejeitarEscopo(projetoId);

  const [confirmAprovar, setConfirmAprovar] = useState<EscopoRow | null>(null);
  const [confirmRejeitar, setConfirmRejeitar] = useState<EscopoRow | null>(null);

  const handleAprovar = async () => {
    if (!confirmAprovar) return;
    try {
      await aprovar.mutateAsync(confirmAprovar.id);
      toast.success("Aditivo aprovado — contrato e orçamento atualizados");
      setConfirmAprovar(null);
    } catch {
      toast.error("Não foi possível aprovar o aditivo");
    }
  };

  const handleRejeitar = async () => {
    if (!confirmRejeitar) return;
    try {
      await rejeitar.mutateAsync(confirmRejeitar.id);
      toast.success("Aditivo rejeitado");
      setConfirmRejeitar(null);
    } catch {
      toast.error("Não foi possível rejeitar o aditivo");
    }
  };

  if (escopos.isLoading || orcamentoVivo.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const aditivos = (escopos.data ?? []).filter((e) => e.tipo === "aditivo");

  return (
    <div className="space-y-4">
      <KPICard label="Orçamento vivo do projeto" value={orcamentoVivo.data ?? 0} icon={ScrollText} tone="info" />

      {aditivos.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum aditivo por aqui ainda. Aditivos aparecem quando o escopo do projeto muda —
            criados manualmente pelo chat ou sugeridos automaticamente quando as despesas passam
            do orçamento vivo.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {aditivos.map((escopo) => (
            <AditivoCard
              key={escopo.id}
              escopo={escopo}
              canEdit={canEdit}
              onAprovar={() => setConfirmAprovar(escopo)}
              onRejeitar={() => setConfirmRejeitar(escopo)}
            />
          ))}
        </div>
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

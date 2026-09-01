import { useState } from "react";
import { ScrollText, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { KPICard } from "@/components/KPICard";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { AditivoReviewCard } from "@/components/AditivoReviewCard";
import { formatCurrency } from "@/lib/format";
import { parseCurrencyString } from "@/lib/currencyUtils";
import {
  useEscopos,
  useOrcamentoFases,
  useSalvarOrcamentoFase,
  useAprovarEscopo,
  useRejeitarEscopo,
  type EscopoRow,
  type OrcamentoFaseRow,
} from "@/hooks/useEscopos";

interface EscopoTabProps {
  projetoId: string;
  canEdit: boolean;
  /** Nomes das disciplinas do projeto (spec 083) — cada uma vira uma linha editável de orçamento. */
  disciplinas: string[];
}

function OrcamentoDisciplinaRow({
  projetoId,
  nome,
  fase,
  canEdit,
}: {
  projetoId: string;
  nome: string;
  fase: OrcamentoFaseRow | undefined;
  canEdit: boolean;
}) {
  const salvar = useSalvarOrcamentoFase(projetoId);
  // Estado inicializado uma vez a partir do valor carregado (o pai só monta esta linha
  // depois que orcamentoFases resolve — ver EscopoTab). Não ressincroniza em re-render:
  // se resincronizasse via efeito, salvar OUTRA linha invalidaria a lista inteira e
  // apagaria uma edição em andamento nesta.
  const [horas, setHoras] = useState(() => String(fase?.horas_estimadas ?? ""));
  const [custoHora, setCustoHora] = useState(() => (fase?.custo_hora ? formatCurrency(fase.custo_hora) : ""));

  const dirty = horas !== String(fase?.horas_estimadas ?? "") || custoHora !== (fase?.custo_hora ? formatCurrency(fase.custo_hora) : "");

  const salvarLinha = async () => {
    try {
      await salvar.mutateAsync({
        disciplina: nome,
        horasEstimadas: Number(horas) || 0,
        custoHora: parseCurrencyString(custoHora),
      });
      toast.success(`Orçamento de ${nome} atualizado`);
    } catch {
      toast.error(`Não foi possível salvar o orçamento de ${nome}`);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 py-2">
      <span className="truncate text-sm text-foreground">{nome}</span>
      <Input
        type="number"
        min={0}
        value={horas}
        onChange={(e) => setHoras(e.target.value)}
        disabled={!canEdit}
        placeholder="Horas"
        aria-label={`Horas estimadas — ${nome}`}
        className="h-9 w-24"
      />
      <MoneyInput
        value={custoHora}
        onChange={setCustoHora}
        disabled={!canEdit}
        aria-label={`Custo por hora — ${nome}`}
        className="h-9 w-32"
      />
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatCurrency((Number(horas) || 0) * parseCurrencyString(custoHora))}
      </span>
      {canEdit && dirty && (
        <Button size="sm" variant="ghost" onClick={salvarLinha} disabled={salvar.isPending} className="h-8 gap-1 px-2">
          <Check className="h-3.5 w-3.5" /> Salvar
        </Button>
      )}
    </div>
  );
}

export function EscopoTab({ projetoId, canEdit, disciplinas }: EscopoTabProps) {
  const escopos = useEscopos(projetoId);
  const orcamentoFases = useOrcamentoFases(projetoId);
  const aprovar = useAprovarEscopo();
  const rejeitar = useRejeitarEscopo();

  const [confirmAprovar, setConfirmAprovar] = useState<EscopoRow | null>(null);
  const [confirmRejeitar, setConfirmRejeitar] = useState<EscopoRow | null>(null);

  const handleAprovar = async () => {
    if (!confirmAprovar) return;
    try {
      await aprovar.mutateAsync({ escopoId: confirmAprovar.id, projetoId });
      toast.success("Aditivo aprovado — contrato e orçamento atualizados");
      setConfirmAprovar(null);
    } catch {
      toast.error("Não foi possível aprovar o aditivo");
    }
  };

  const handleRejeitar = async () => {
    if (!confirmRejeitar) return;
    try {
      await rejeitar.mutateAsync({ escopoId: confirmRejeitar.id, projetoId });
      toast.success("Aditivo rejeitado");
      setConfirmRejeitar(null);
    } catch {
      toast.error("Não foi possível rejeitar o aditivo");
    }
  };

  if (escopos.isLoading || orcamentoFases.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const aditivos = (escopos.data ?? []).filter((e) => e.tipo === "aditivo");
  const fasesPorDisciplina = new Map((orcamentoFases.data ?? []).map((f) => [f.disciplina, f]));
  const orcamentoTotal = (orcamentoFases.data ?? []).reduce((s, f) => s + (f.custo_estimado ?? 0), 0);

  return (
    <div className="space-y-4">
      <KPICard label="Orçamento vivo do projeto" value={orcamentoTotal} icon={ScrollText} tone="info" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Orçamento por disciplina</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border pt-0">
          {disciplinas.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Este projeto ainda não tem disciplinas cadastradas — adicione uma na aba
              Disciplinas antes de definir orçamento.
            </p>
          ) : (
            disciplinas.map((nome) => (
              <OrcamentoDisciplinaRow
                key={nome}
                projetoId={projetoId}
                nome={nome}
                fase={fasesPorDisciplina.get(nome)}
                canEdit={canEdit}
              />
            ))
          )}
        </CardContent>
      </Card>

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
            <AditivoReviewCard
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

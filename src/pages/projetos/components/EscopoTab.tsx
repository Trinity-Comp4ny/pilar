import { useEffect, useRef, useState } from "react";
import { ScrollText, Check, Plus } from "lucide-react";
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
  useRejeitarEscopo,
  type EscopoRow,
  type OrcamentoFaseRow,
} from "@/hooks/useEscopos";

import { AprovarAditivoProjeto, NovoAditivoProjeto, type DisciplinaAditivo } from "@/components/AditivoProjetoDialogs";
import { useResumoAditivos } from "@/hooks/useAditivosProjeto";

interface EscopoTabProps {
  projetoId: string;
  canEdit: boolean;
  /** Nomes das disciplinas do projeto (spec 083) — cada uma vira uma linha editável de orçamento. */
  disciplinas: string[];
  opcoesDisciplina?: DisciplinaAditivo[];
  podeVerFinanceiro?: boolean;
  aditivoDestacado?: string;
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

  const dirty =
    horas !== String(fase?.horas_estimadas ?? "") ||
    custoHora !== (fase?.custo_hora ? formatCurrency(fase.custo_hora) : "");

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
    <div className="grid grid-cols-2 items-center gap-2 py-2 md:grid-cols-[minmax(0,1fr)_6rem_8rem_8rem_4.5rem]">
      <span className="col-span-2 text-sm font-medium text-foreground md:col-span-1 md:truncate">{nome}</span>
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground md:hidden">Horas previstas</span>
        <Input
          type="number"
          min={0}
          value={horas}
          onChange={(e) => setHoras(e.target.value)}
          disabled={!canEdit}
          placeholder="0 h"
          aria-label={`Horas estimadas — ${nome}`}
          className="h-9 w-full"
        />
      </div>
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground md:hidden">Custo da hora</span>
        <MoneyInput
          value={custoHora}
          onChange={setCustoHora}
          disabled={!canEdit}
          aria-label={`Custo por hora — ${nome}`}
          className="h-9 w-full"
        />
      </div>
      <span className="whitespace-nowrap text-sm font-medium tabular-nums text-foreground md:text-right">
        <span className="block text-xs font-normal text-muted-foreground md:hidden">Custo estimado</span>
        {formatCurrency((Number(horas) || 0) * parseCurrencyString(custoHora))}
      </span>
      {canEdit && dirty ? (
        <Button size="xs" variant="brand" onClick={salvarLinha} disabled={salvar.isPending} className="gap-1 px-2">
          <Check className="h-3.5 w-3.5" /> Salvar
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

export function EscopoTab({
  projetoId,
  canEdit,
  disciplinas,
  opcoesDisciplina,
  podeVerFinanceiro,
  aditivoDestacado,
}: EscopoTabProps) {
  const escopos = useEscopos(projetoId);
  const orcamentoFases = useOrcamentoFases(projetoId);
  const [novoAditivo, setNovoAditivo] = useState(false);
  const rejeitar = useRejeitarEscopo();

  const [confirmAprovar, setConfirmAprovar] = useState<EscopoRow | null>(null);
  const [confirmRejeitar, setConfirmRejeitar] = useState<EscopoRow | null>(null);
  const cardDestacado = useRef<HTMLDivElement>(null);
  const destaqueDisponivel = (escopos.data ?? []).some((e) => e.id === aditivoDestacado);
  useEffect(() => {
    if (destaqueDisponivel && !escopos.isLoading && !orcamentoFases.isLoading) cardDestacado.current?.focus();
  }, [aditivoDestacado, destaqueDisponivel, escopos.isLoading, orcamentoFases.isLoading]);

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
          <p className="text-xs text-muted-foreground">
            Quanto o escritório planeja gastar para entregar cada disciplina: horas previstas × custo da hora da equipe.
            O custo da hora é definido aqui, por projeto (não vem de outra tela). A soma forma o orçamento vivo, que o
            sistema compara com as despesas para sugerir aditivos.
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border pt-0">
          {disciplinas.length > 0 && (
            <div className="hidden grid-cols-[minmax(0,1fr)_6rem_8rem_8rem_4.5rem] gap-2 pb-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
              <span>Disciplina</span>
              <span>Horas previstas</span>
              <span>Custo da hora</span>
              <span className="text-right">Custo estimado</span>
              <span />
            </div>
          )}
          {disciplinas.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Este projeto ainda não tem disciplinas cadastradas — adicione uma na aba Disciplinas antes de definir
              orçamento.
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Aditivos</h3>
        {canEdit && podeVerFinanceiro && (
          <Button size="sm" onClick={() => setNovoAditivo(true)}>
            <Plus className="h-4 w-4" /> Novo aditivo
          </Button>
        )}
      </div>
      {podeVerFinanceiro && <ResumoAditivos projetoId={projetoId} />}
      {aditivos.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum aditivo por aqui ainda. Registre uma mudança cobrável aqui ou a partir de uma revisão.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {aditivos.map((escopo) => (
            <div
              key={escopo.id}
              ref={escopo.id === aditivoDestacado ? cardDestacado : undefined}
              tabIndex={escopo.id === aditivoDestacado ? -1 : undefined}
            >
              <AditivoReviewCard
                escopo={escopo}
                canEdit={canEdit}
                onAprovar={() => setConfirmAprovar(escopo)}
                onRejeitar={() => setConfirmRejeitar(escopo)}
              />
            </div>
          ))}
        </div>
      )}

      {novoAditivo && (
        <NovoAditivoProjeto
          projetoId={projetoId}
          disciplinas={opcoesDisciplina}
          origem={{}}
          fechar={() => setNovoAditivo(false)}
        />
      )}
      {confirmAprovar && (
        <AprovarAditivoProjeto
          projetoId={projetoId}
          aditivoId={confirmAprovar.id}
          descricao={confirmAprovar.descricao}
          fechar={() => setConfirmAprovar(null)}
        />
      )}
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

function ResumoAditivos({ projetoId }: { projetoId: string }) {
  const { data } = useResumoAditivos(projetoId);
  if (!data) return null;
  return (
    <dl className="grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">Valor original</dt>
        <dd>{data.original == null ? "Original não registrado" : formatCurrency(data.original)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Aditivos aprovados</dt>
        <dd>{formatCurrency(data.aprovados)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Total atualizado</dt>
        <dd>{data.total == null ? "—" : formatCurrency(data.total)}</dd>
      </div>
    </dl>
  );
}

import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/format";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import type { ObraResumo } from "@/hooks/useObras";
import { useObraFrentes } from "@/hooks/useObraFrentes";
import { useObraConta, useDeleteLancamento, type ObraLancamentoRow } from "@/hooks/useObraConta";
import { useObraOrcamento, useSaveOrcamentoEtapa } from "@/hooks/useObraOrcamento";
import {
  calcularSaldoConta,
  desvioOrcamento,
  pagoPorLabel,
  realizadoPorEtapa,
  SEM_ETAPA,
  totalAdiantadoEscritorio,
} from "@/lib/obras";
import { LancamentoContaDialog } from "./LancamentoContaDialog";
import { ObraDesembolsoChart } from "./ObraDesembolsoChart";

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "danger" | "muted" }) {
  return (
    <Card className="rounded-2xl border border-black/5 bg-white">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-lg font-semibold ${tone === "danger" ? "text-danger-strong" : "text-ink"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

/** Linha de orçamento por etapa: previsto editável inline, realizado e desvio. */
function EtapaOrcamentoRow({
  nome,
  previsto,
  realizado,
  canEdit,
  onSave,
}: {
  nome: string;
  previsto: number;
  realizado: number;
  canEdit: boolean;
  onSave: (v: number) => void;
}) {
  const formatCurrency = useMoneyMask();
  const [draft, setDraft] = useState<string>(previsto ? String(previsto) : "");
  const desvio = desvioOrcamento(previsto, realizado);
  const estourou = desvio.valor > 0 && previsto > 0;

  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <span className="flex-1 text-ink">{nome}</span>
      {canEdit ? (
        <Input
          type="number"
          step="0.01"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const v = Number(draft) || 0;
            if (v !== previsto) onSave(v);
          }}
          placeholder="Previsto"
          className="h-8 w-28 text-right"
        />
      ) : (
        <span className="w-28 text-right text-muted-foreground">{previsto ? formatCurrency(previsto) : "—"}</span>
      )}
      <span className="w-28 text-right text-ink">{formatCurrency(realizado)}</span>
      <span className={`w-24 text-right ${estourou ? "text-danger-strong" : "text-muted-foreground"}`}>
        {previsto > 0 ? `${desvio.valor >= 0 ? "+" : ""}${formatCurrency(desvio.valor)}` : "—"}
        {desvio.pct != null && ` (${desvio.pct >= 0 ? "+" : ""}${desvio.pct}%)`}
      </span>
    </div>
  );
}

export function ObraContaTab({ obra, canEdit }: { obra: ObraResumo; canEdit: boolean }) {
  const formatCurrency = useMoneyMask();
  const obraId = obra.id;
  const { data: lancamentos = [], isLoading } = useObraConta(obraId);
  const { data: frentes = [] } = useObraFrentes(obraId);
  const { data: orcamentos = [] } = useObraOrcamento(obraId);
  const del = useDeleteLancamento(obraId);
  const saveOrcamento = useSaveOrcamentoEtapa(obraId);

  const [dialog, setDialog] = useState<{ tipo: "aporte" | "despesa"; lancamento?: ObraLancamentoRow | null } | null>(
    null
  );
  const [confirmDel, setConfirmDel] = useState<ObraLancamentoRow | null>(null);

  const saldo = useMemo(() => calcularSaldoConta(lancamentos), [lancamentos]);
  const totalAportes = useMemo(
    () => lancamentos.filter((l) => l.tipo === "aporte").reduce((a, l) => a + Number(l.valor), 0),
    [lancamentos]
  );
  const totalDespesas = useMemo(
    () => lancamentos.filter((l) => l.tipo === "despesa").reduce((a, l) => a + Number(l.valor), 0),
    [lancamentos]
  );
  const adiantado = useMemo(() => totalAdiantadoEscritorio(lancamentos), [lancamentos]);
  const realizado = useMemo(() => realizadoPorEtapa(lancamentos), [lancamentos]);
  const previstoPorFrente = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orcamentos) m.set(o.obra_frente_id, Number(o.valor_previsto));
    return m;
  }, [orcamentos]);
  const frenteNome = useMemo(() => new Map(frentes.map((f) => [f.id, f.nome])), [frentes]);

  const taxaAtiva = obra.modelo_cobranca === "administracao" && Number(obra.taxa_administracao_pct) > 0;

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Saldo da conta" value={formatCurrency(saldo)} tone={saldo < 0 ? "danger" : undefined} />
        <Kpi label="Aportes do cliente" value={formatCurrency(totalAportes)} />
        <Kpi label="Despesas" value={formatCurrency(totalDespesas)} />
        {adiantado > 0 && <Kpi label="Escritório adiantou" value={formatCurrency(adiantado)} tone="danger" />}
      </div>

      <Card className="rounded-2xl border border-black/5 bg-white">
        <CardContent className="p-4">
          <h3 className="mb-1 text-sm font-medium text-ink">Desembolso realizado</h3>
          <ObraDesembolsoChart lancamentos={lancamentos} orcamentos={orcamentos} />
        </CardContent>
      </Card>

      {taxaAtiva && (
        <p className="text-xs text-muted-foreground">
          Taxa de administração de {Number(obra.taxa_administracao_pct)}% vira receita do escritório a cada despesa. O
          custo da obra fica nesta conta, fora da margem do escritório.
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialog({ tipo: "aporte" })}>
            <ArrowDownCircle className="mr-1.5 h-4 w-4" />
            Aporte
          </Button>
          <Button variant="brand" size="sm" onClick={() => setDialog({ tipo: "despesa" })}>
            <ArrowUpCircle className="mr-1.5 h-4 w-4" />
            Despesa
          </Button>
        </div>
      )}

      {/* Previsto vs realizado por etapa */}
      {frentes.length > 0 && (
        <Card className="rounded-2xl border border-black/5 bg-white">
          <CardContent className="p-4">
            <h3 className="mb-1 text-sm font-medium text-ink">Previsto vs realizado por etapa</h3>
            <div className="flex items-center gap-3 border-b border-black/5 pb-1 text-xs text-muted-foreground">
              <span className="flex-1">Etapa</span>
              <span className="w-28 text-right">Previsto</span>
              <span className="w-28 text-right">Realizado</span>
              <span className="w-24 text-right">Desvio</span>
            </div>
            <div className="divide-y divide-black/5">
              {frentes.map((f) => (
                <EtapaOrcamentoRow
                  key={f.id}
                  nome={f.nome}
                  previsto={previstoPorFrente.get(f.id) ?? 0}
                  realizado={realizado[f.id] ?? 0}
                  canEdit={canEdit}
                  onSave={(v) => saveOrcamento.mutate({ obraFrenteId: f.id, valorPrevisto: v })}
                />
              ))}
              {(realizado[SEM_ETAPA] ?? 0) > 0 && (
                <EtapaOrcamentoRow
                  nome="Sem etapa"
                  previsto={0}
                  realizado={realizado[SEM_ETAPA]}
                  canEdit={false}
                  onSave={() => {}}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extrato */}
      {lancamentos.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum lançamento ainda"
          description="Registre o aporte do cliente e as despesas pagas com esse dinheiro. O saldo e a prestação de contas se montam sozinhos."
        />
      ) : (
        <Card className="rounded-2xl border border-black/5 bg-white">
          <CardContent className="divide-y divide-black/5 p-4">
            {lancamentos.map((l) => {
              const isAporte = l.tipo === "aporte";
              const etapa = l.obra_frente_id ? frenteNome.get(l.obra_frente_id) : null;
              return (
                <div key={l.id} className="flex items-center gap-3 py-2 text-sm">
                  {isAporte ? (
                    <ArrowDownCircle className="h-4 w-4 shrink-0 text-positive" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink">{l.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(l.data)}
                      {etapa && ` · ${etapa}`}
                      {l.pago_por === "escritorio_reembolsavel" && ` · ${pagoPorLabel(l.pago_por)}`}
                    </p>
                  </div>
                  <span className={isAporte ? "text-positive" : "text-ink"}>
                    {isAporte ? "+" : "−"}
                    {formatCurrency(Number(l.valor))}
                  </span>
                  {canEdit && (
                    <div className="flex shrink-0">
                      {!isAporte && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDialog({ tipo: "despesa", lancamento: l })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDel(l)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {dialog && (
        <LancamentoContaDialog
          open
          onOpenChange={(v) => !v && setDialog(null)}
          obraId={obraId}
          tipo={dialog.tipo}
          lancamento={dialog.lancamento}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          await del.mutateAsync({ id: confirmDel.id, tipo: confirmDel.tipo });
          setConfirmDel(null);
        }}
        title="Excluir lançamento?"
        itemName={confirmDel?.descricao}
        description={
          confirmDel?.tipo === "despesa"
            ? "A despesa sai da conta da obra e a taxa de administração correspondente é estornada."
            : "O aporte sai da conta da obra."
        }
        variant="destructive"
        confirmText="Excluir"
        loading={del.isPending}
      />
    </div>
  );
}

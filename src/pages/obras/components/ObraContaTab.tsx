import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calculator,
  FileText,
  FileUp,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarRange,
  Pencil,
  Trash2,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { formatDate } from "@/lib/format";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import type { ObraResumo } from "@/pages/obras/hooks/useObras";
import { useFornecedoresLite } from "@/pages/obras/hooks/useFornecedoresLite";
import { useObraFrentes } from "@/pages/obras/hooks/useObraFrentes";
import { achatarOrcado, montarOrcadoRealizado } from "@/lib/orcadoRealizado";
import { useObraConta, useDeleteLancamento, type ObraLancamentoRow } from "@/pages/obras/hooks/useObraConta";
import { useObraOrcamento, useSaveOrcamentoEtapa } from "@/pages/obras/hooks/useObraOrcamento";
import { calcularSaldoConta, pagoPorLabel, realizadoPorEtapa, SEM_ETAPA, totalAdiantadoEscritorio } from "@/lib/obras";
import { FILTRO_VAZIO, filtrarExtrato, filtroAtivo, type FiltroExtrato } from "@/pages/obras/lib/filtroExtrato";
import { ExtratoFiltros } from "./ExtratoFiltros";
import { LancamentoContaDialog } from "./LancamentoContaDialog";
import { ObraDesembolsoChart } from "./ObraDesembolsoChart";
import { RelatorioClienteDialog } from "./RelatorioClienteDialog";
import { PreencherOrcadoDialog } from "./PreencherOrcadoDialog";
import { ImportarExtratoDialog } from "./ImportarExtratoDialog";
import { ObraDespesasAgrupadas } from "./ObraDespesasAgrupadas";
import { ObraOrcadoRealizadoCard } from "./ObraOrcadoRealizado";
import { ObraFisicoFinanceiro } from "./ObraFisicoFinanceiro";

type VisaoFinanceiro = "conta" | "fisico";
const VISOES: ViewOption<VisaoFinanceiro>[] = [
  { value: "conta", label: "Conta", icon: Wallet },
  { value: "fisico", label: "Físico-financeiro", icon: CalendarRange },
];

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

export function ObraContaTab({
  obra,
  canEdit,
  onIrParaCronograma,
}: {
  obra: ObraResumo;
  canEdit: boolean;
  onIrParaCronograma?: () => void;
}) {
  const [visao, setVisao] = useState<VisaoFinanceiro>("conta");
  const formatCurrency = useMoneyMask();
  const obraId = obra.id;
  const { data: lancamentos = [], isLoading } = useObraConta(obraId);
  const { data: nos = [] } = useObraFrentes(obraId);
  const { data: fornecedores = [] } = useFornecedoresLite();
  const fornecedorNome = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);
  const { data: orcamentos = [] } = useObraOrcamento(obraId);
  const del = useDeleteLancamento(obraId);
  const saveOrcamento = useSaveOrcamentoEtapa(obraId);

  const [dialog, setDialog] = useState<{ tipo: "aporte" | "despesa"; lancamento?: ObraLancamentoRow | null } | null>(
    null
  );
  const [preenchendo, setPreenchendo] = useState(false);
  const [importandoExtrato, setImportandoExtrato] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [confirmDel, setConfirmDel] = useState<ObraLancamentoRow | null>(null);
  const [filtro, setFiltro] = useState<FiltroExtrato>(FILTRO_VAZIO);

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
  const orcado = useMemo(
    () => montarOrcadoRealizado(nos, previstoPorFrente, realizado, realizado[SEM_ETAPA] ?? 0),
    [nos, previstoPorFrente, realizado]
  );
  // Caminho inteiro ("Fase › Etapa › Serviço") para citar cada lançamento.
  const caminhoDoNo = useMemo(
    () => new Map(achatarOrcado(orcado.raizes).map((l) => [l.no.id, l.caminho])),
    [orcado.raizes]
  );

  const extrato = useMemo(() => filtrarExtrato(lancamentos, filtro), [lancamentos, filtro]);
  const fornecedoresDoExtrato = useMemo(
    () =>
      [...new Set(lancamentos.map((l) => l.fornecedor_id).filter((id): id is string => !!id))]
        .map((id) => ({ id, nome: fornecedorNome.get(id) ?? "Fornecedor" }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [lancamentos, fornecedorNome]
  );

  const taxaAtiva = obra.modelo_cobranca === "administracao" && Number(obra.taxa_administracao_pct) > 0;

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const seletor = (
    <ViewSwitcher options={VISOES} value={visao} onChange={setVisao} ariaLabel="Visão do financeiro da obra" />
  );

  if (visao === "fisico") {
    return (
      <div className="space-y-4">
        {seletor}
        <ObraFisicoFinanceiro
          obraId={obraId}
          onIrParaConta={() => setVisao("conta")}
          onIrParaCronograma={onIrParaCronograma}
          canEdit={canEdit}
          obraNome={obra.nome}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {seletor}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Orçado" value={orcado.totalPrevisto > 0 ? formatCurrency(orcado.totalPrevisto) : "—"} />
        <Kpi
          label="Realizado"
          value={formatCurrency(orcado.totalRealizado)}
          tone={orcado.totalPrevisto > 0 && orcado.totalRealizado > orcado.totalPrevisto ? "danger" : undefined}
        />
        <Kpi label="Saldo da conta" value={formatCurrency(saldo)} tone={saldo < 0 ? "danger" : undefined} />
        <Kpi label="Aportes do cliente" value={formatCurrency(totalAportes)} />
        <Kpi label="Despesas" value={formatCurrency(totalDespesas)} />
        {adiantado > 0 && <Kpi label="Escritório adiantou" value={formatCurrency(adiantado)} tone="danger" />}
      </div>

      {/* Orçado x realizado por fase, etapa e serviço */}
      {nos.length > 0 && (
        <ObraOrcadoRealizadoCard
          dados={orcado}
          canEdit={canEdit}
          onSave={(id, v) => saveOrcamento.mutate({ obraFrenteId: id, valorPrevisto: v })}
        />
      )}

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

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => setDialog({ tipo: "aporte" })}>
              <ArrowDownCircle className="mr-1.5 h-4 w-4" />
              Aporte
            </Button>
            <Button variant="brand" size="sm" onClick={() => setDialog({ tipo: "despesa" })}>
              <ArrowUpCircle className="mr-1.5 h-4 w-4" />
              Despesa
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreenchendo(true)}>
              <Calculator className="mr-1.5 h-4 w-4" />
              Orçado pela estimativa
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportandoExtrato(true)}>
              <FileUp className="mr-1.5 h-4 w-4" />
              Importar extrato
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={() => setRelatorioAberto(true)}>
          <FileText className="mr-1.5 h-4 w-4" />
          Relatório do cliente
        </Button>
      </div>

      <ObraDespesasAgrupadas lancamentos={lancamentos} nomeFornecedor={fornecedorNome} />

      {/* Extrato */}
      {lancamentos.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum lançamento ainda"
          description="Registre o aporte do cliente e as despesas pagas com esse dinheiro. O saldo e a prestação de contas se montam sozinhos."
        />
      ) : (
        <div className="space-y-3">
          <ExtratoFiltros filtro={filtro} onChange={setFiltro} fornecedores={fornecedoresDoExtrato} />
          {extrato.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhum lançamento com esse filtro"
              description="Ajuste o tipo, o fornecedor ou a busca para ver o extrato."
            />
          ) : (
            <Card className="rounded-2xl border border-black/5 bg-white">
              <CardContent className="divide-y divide-black/5 p-4">
                {extrato.map((l) => {
                  const isAporte = l.tipo === "aporte";
                  const etapa = l.obra_frente_id ? caminhoDoNo.get(l.obra_frente_id) : null;
                  return (
                    <div key={l.id} className="flex items-center gap-3 py-2 text-sm">
                      {isAporte ? (
                        <ArrowDownCircle className="h-4 w-4 shrink-0 text-positive" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ink">
                          {l.descricao}
                          {l.quantidade != null && (
                            <span className="text-muted-foreground">
                              {` · ${Number(l.quantidade).toLocaleString("pt-BR")}${l.unidade ? ` ${l.unidade}` : ""}`}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(l.data)}
                          {etapa && ` · ${etapa}`}
                          {l.fornecedor_id &&
                            fornecedorNome.get(l.fornecedor_id) &&
                            ` · ${fornecedorNome.get(l.fornecedor_id)}`}
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
                              aria-label={`Editar ${l.descricao}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setConfirmDel(l)}
                            aria-label={`Excluir lançamento ${l.descricao}`}
                          >
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
          {filtroAtivo(filtro) && (
            <p className="text-xs text-muted-foreground">
              {extrato.length} de {lancamentos.length} lançamentos
            </p>
          )}
        </div>
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

      {relatorioAberto && (
        <RelatorioClienteDialog
          open
          onOpenChange={(v) => !v && setRelatorioAberto(false)}
          obraId={obraId}
          obraNome={obra.nome}
        />
      )}
      {importandoExtrato && (
        <ImportarExtratoDialog
          open
          onOpenChange={(v) => !v && setImportandoExtrato(false)}
          obraId={obraId}
          lancamentos={lancamentos}
        />
      )}
      {preenchendo && <PreencherOrcadoDialog open onOpenChange={(v) => !v && setPreenchendo(false)} obraId={obraId} />}

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await del.mutateAsync({ id: confirmDel.id, tipo: confirmDel.tipo });
            setConfirmDel(null);
          } catch (e) {
            toast.error("Não foi possível excluir", {
              description: e instanceof Error ? e.message : "Tente novamente",
            });
          }
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

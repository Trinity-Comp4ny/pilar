import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarRange, Download } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { analytics } from "@/lib/analytics";
import { toIso } from "@/lib/cronograma";
import { desembolsoAcumuladoPorMes } from "@/lib/obras";
import { useObraConta } from "@/pages/obras/hooks/useObraConta";
import { useObraFrentes } from "@/pages/obras/hooks/useObraFrentes";
import { useObraOrcamento } from "@/pages/obras/hooks/useObraOrcamento";
import {
  agruparPlanejamentoManual,
  useObraPlanejamentoMes,
  useSalvarPlanejamentoNo,
  useVoltarAoAutomatico,
} from "@/pages/obras/hooks/useObraPlanejamentoMes";
import { useObraTarefas } from "@/pages/obras/hooks/useObraTarefas";
import {
  colunasDaEscala,
  curvaPlanejadoRealizado,
  montarFisicoFinanceiro,
  percentuaisAposEdicao,
  periodosPorNo,
  type EscalaGrade,
  type LinhaFF,
  type MesChave,
} from "@/pages/obras/lib/fisicoFinanceiro";
import {
  baixarPDF,
  baixarXLSX,
  montarTabelaExport,
  nomeArquivoFF,
  NIVEIS_EXPORTACAO,
  type NivelExportacao,
} from "@/pages/obras/lib/exportarFisicoFinanceiro";
import { montarArvoreCronograma } from "@/pages/obras/lib/obraArvore";
import { montarOrcadoRealizado } from "@/pages/obras/lib/orcadoRealizado";
import { FisicoFinanceiroChart } from "./FisicoFinanceiroChart";
import { FisicoFinanceiroGrade } from "./FisicoFinanceiroGrade";
import { FisicoFinanceiroLista } from "./FisicoFinanceiroLista";

const ESCALAS: ViewOption<EscalaGrade>[] = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
];

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Card className="rounded-2xl border border-black/5 bg-white">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{valor}</p>
      </CardContent>
    </Card>
  );
}

interface Props {
  obraId: string;
  /** Volta para a conta da obra, onde o orçado é preenchido. */
  onIrParaConta: () => void;
  /** Abre a aba Cronograma; ausente quando a pessoa não tem acesso a ela. */
  onIrParaCronograma?: () => void;
  /** Pode ajustar o planejamento à mão (mesma regra de editar a obra). */
  canEdit?: boolean;
  /** Nome da obra, para o cabeçalho e o nome do arquivo exportado. */
  obraNome?: string;
}

/**
 * Físico-financeiro da obra (spec 165): desembolso previsto por mês de cada fase, etapa e serviço, calculado do
 * previsto e das datas do cronograma, com o ajuste manual guardado em `obra_planejamento_mes`.
 */
export function ObraFisicoFinanceiro({
  obraId,
  onIrParaConta,
  onIrParaCronograma,
  canEdit = false,
  obraNome = "Obra",
}: Props) {
  const formatCurrency = useMoneyMask();
  const mobile = useIsMobile();
  const frentes = useObraFrentes(obraId);
  const tarefas = useObraTarefas(obraId);
  const orcamentos = useObraOrcamento(obraId);
  const manual = useObraPlanejamentoMes(obraId);
  const conta = useObraConta(obraId);
  const salvar = useSalvarPlanejamentoNo(obraId);
  const voltar = useVoltarAoAutomatico(obraId);

  useEffect(() => {
    analytics.track("abriu_fisico_financeiro");
  }, []);
  const [exportando, setExportando] = useState(false);
  const [escalaEscolhida, setEscala] = useState<EscalaGrade>("mensal");
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const alternar = useCallback(
    (id: string) =>
      setRecolhidos((atual) => {
        const novo = new Set(atual);
        if (novo.has(id)) novo.delete(id);
        else novo.add(id);
        return novo;
      }),
    []
  );

  const nos = frentes.data;
  const tarefasObra = tarefas.data;
  const orcamentosObra = orcamentos.data;
  const manualObra = manual.data;

  const ff = useMemo(() => {
    if (!nos || !tarefasObra || !orcamentosObra || !manualObra) return null;
    const { fases } = montarArvoreCronograma(nos, tarefasObra);
    const previsto = new Map(orcamentosObra.map((o) => [o.obra_frente_id, Number(o.valor_previsto)]));
    const orcado = montarOrcadoRealizado(nos, previsto, {});
    return montarFisicoFinanceiro(orcado.raizes, periodosPorNo(fases), agruparPlanejamentoManual(manualObra));
  }, [nos, tarefasObra, orcamentosObra, manualObra]);

  const lancamentos = conta.data;
  const mesAtual = toIso(new Date()).slice(0, 7);
  const curva = useMemo(
    () => (ff && lancamentos ? curvaPlanejadoRealizado(ff, desembolsoAcumuladoPorMes(lancamentos), mesAtual) : []),
    [ff, lancamentos, mesAtual]
  );

  const carregando =
    frentes.isLoading || tarefas.isLoading || orcamentos.isLoading || manual.isLoading || conta.isLoading;
  const erro = frentes.isError || tarefas.isError || orcamentos.isError || manual.isError || conta.isError;

  if (carregando) return <PageLoader size="section" label="Montando o físico-financeiro" />;

  if (erro || !ff) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Não foi possível carregar o físico-financeiro"
        description="Tente de novo em instantes."
        action={{
          label: "Tentar de novo",
          variant: "outline",
          onClick: () => {
            void frentes.refetch();
            void tarefas.refetch();
            void orcamentos.refetch();
            void manual.refetch();
            void conta.refetch();
          },
        }}
      />
    );
  }

  if (ff.totalPrevisto <= 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Preencha o orçado para planejar o desembolso"
        description="O físico-financeiro reparte o previsto de cada fase, etapa e serviço pelos meses do cronograma. Informe o previsto na conta da obra."
        action={{ label: "Ir para a conta da obra", onClick: onIrParaConta, variant: "brand" }}
      />
    );
  }

  if (ff.meses.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Defina datas no cronograma para distribuir o desembolso"
        description={`Há ${formatCurrency(ff.semData.valor)} previstos em ${ff.semData.itens} ${
          ff.semData.itens === 1 ? "item" : "itens"
        } sem data de início e fim.`}
        action={
          onIrParaCronograma
            ? { label: "Abrir o cronograma", onClick: onIrParaCronograma, variant: "brand" }
            : undefined
        }
      />
    );
  }

  // Passou de 60 meses: a escala mensal não cabe, a trimestral é a única.
  const escala: EscalaGrade = ff.excedeLimite ? "trimestral" : escalaEscolhida;
  const colunas = colunasDaEscala(ff.meses, escala);
  const falhou = (titulo: string) => ({
    onError: (e: unknown) =>
      // Erro do Supabase chega como objeto com `message`, não como `Error`.
      toast.error(titulo, { description: (e as { message?: string } | null)?.message || "Tente novamente" }),
  });
  const salvarCelula = (linha: LinhaFF, mes: MesChave, percentual: number) => {
    analytics.track("editou_celula_fisico_financeiro");
    salvar.mutate(
      { obraFrenteId: linha.id, percentuais: percentuaisAposEdicao(linha, ff.meses, mes, percentual) },
      falhou("Não foi possível salvar o planejamento")
    );
  };
  const voltarAutomatico = (linha: LinhaFF) =>
    voltar.mutate(linha.id, {
      ...falhou("Não foi possível voltar ao automático"),
      onSuccess: () => toast.success("Voltou a seguir o cronograma", { description: linha.nome }),
    });
  const exportar = async (formato: "xlsx" | "pdf", nivel: NivelExportacao) => {
    setExportando(true);
    try {
      const tabela = montarTabelaExport(ff, nivel);
      const cab = { obraNome, nivelRotulo: NIVEIS_EXPORTACAO.find((n) => n.value === nivel)?.label ?? nivel };
      const nome = nomeArquivoFF(obraNome, nivel);
      if (formato === "xlsx") await baixarXLSX(tabela, cab, nome);
      else await baixarPDF(tabela, cab, nome);
      analytics.track("exportou_fisico_financeiro", { formato, nivel });
    } catch {
      toast.error("Não foi possível exportar", { description: "Tente novamente." });
    } finally {
      setExportando(false);
    }
  };
  const editavel = canEdit && escala === "mensal" && !mobile;
  const distribuido = Math.round((ff.totalPrevisto - ff.semData.valor - ff.diferencaManual) * 100) / 100;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi rotulo="Previsto" valor={formatCurrency(ff.totalPrevisto)} />
        <Kpi rotulo="Distribuído nos meses" valor={formatCurrency(distribuido)} />
        <Kpi rotulo="Primeiro mês" valor={colunasDaEscala(ff.meses, "mensal")[0].rotulo} />
        <Kpi rotulo="Último mês" valor={colunasDaEscala(ff.meses, "mensal")[ff.meses.length - 1].rotulo} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewSwitcher options={ESCALAS} value={escala} onChange={setEscala} ariaLabel="Escala do físico-financeiro" />
        {canEdit && escala === "trimestral" && !ff.excedeLimite && (
          <p className="text-xs text-muted-foreground">Para ajustar um mês, volte à escala mensal.</p>
        )}
        {ff.excedeLimite && (
          <p className="text-xs text-muted-foreground">Mais de 60 meses: a escala trimestral é a única que cabe.</p>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" loading={exportando}>
              <Download className="h-4 w-4" aria-hidden />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["xlsx", "pdf"] as const).map((formato, i) => (
              <div key={formato}>
                {i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{formato === "xlsx" ? "Excel" : "PDF"}</DropdownMenuLabel>
                {NIVEIS_EXPORTACAO.map((n) => (
                  <DropdownMenuItem key={n.value} onSelect={() => void exportar(formato, n.value)}>
                    {n.label}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {ff.semData.valor > 0 && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {formatCurrency(ff.semData.valor)} em {ff.semData.itens} {ff.semData.itens === 1 ? "item" : "itens"} sem
              data no cronograma. Eles ficam na coluna "Sem data".
            </span>
            {onIrParaCronograma && (
              <Button variant="outline" size="sm" onClick={onIrParaCronograma}>
                Abrir o cronograma
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {Math.abs(ff.diferencaManual) >= 0.01 && (
        <Alert>
          <AlertDescription>
            O planejamento manual não fecha o previsto: diferença de {formatCurrency(Math.abs(ff.diferencaManual))}{" "}
            {ff.diferencaManual > 0 ? "a distribuir" : "acima do previsto"}.
          </AlertDescription>
        </Alert>
      )}

      <FisicoFinanceiroChart pontos={curva} mesAtual={mesAtual} />

      {mobile ? (
        <FisicoFinanceiroLista ff={ff} colunas={colunas} />
      ) : (
        <FisicoFinanceiroGrade
          ff={ff}
          colunas={colunas}
          recolhidos={recolhidos}
          onToggle={alternar}
          editavel={editavel}
          onSalvarCelula={salvarCelula}
          onVoltarAutomatico={voltarAutomatico}
          ocupado={salvar.isPending || voltar.isPending}
        />
      )}
    </div>
  );
}

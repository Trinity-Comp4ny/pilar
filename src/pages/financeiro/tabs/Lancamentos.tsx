import { useCallback, useMemo, useState } from "react";
import { KPICard } from "@/components/KPICard";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Clock, Plus, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { LancamentosTable } from "../components/LancamentosTable";
import { useLancamentosResumo } from "../hooks/useLancamentosResumo";
import { LancamentoFormDialog } from "../components/LancamentoFormDialog";
import { TransferenciaFormDialog } from "../components/TransferenciaFormDialog";
import { ImportarLancamentosDialog } from "../components/ImportarLancamentosDialog";
import {
  periodoRange,
  readFiltersFromParams,
  writeFiltersToParams,
  type LancamentosFilters,
} from "../components/lancamentosFilters";
import type { TipoLancamento } from "../hooks/useLancamentosUnified";

/** Invalida as três queries da tela (página, resumo, grupos) de uma vez. */
export function invalidateLancamentos(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["lancamentos-pagina"] });
  qc.invalidateQueries({ queryKey: ["lancamentos-resumo"] });
  qc.invalidateQueries({ queryKey: ["grupos-parcela-resumo"] });
}

/** Rótulo legível do recorte de período ativo, para deixar o corte explícito. */
function recorteLabel(f: LancamentosFilters): string {
  if (f.periodo === "tudo") return "todo o período";
  if (f.periodo === "custom") {
    const de = f.customFrom ? format(parseISO(f.customFrom), "dd/MM/yyyy") : "…";
    const ate = f.customTo ? format(parseISO(f.customTo), "dd/MM/yyyy") : "…";
    return `${de} a ${ate}`;
  }
  const r = periodoRange(f);
  if (f.periodo === "mes-atual" || f.periodo === "mes-anterior") {
    return r.from ? format(parseISO(r.from), "MMMM 'de' yyyy", { locale: ptBR }) : f.periodo;
  }
  if (f.periodo === "ano") return r.from ? format(parseISO(r.from), "yyyy") : "este ano";
  if (f.periodo === "ultimos-30") return "últimos 30 dias";
  return f.periodo;
}

export default function Lancamentos() {
  // Filtros vivem na URL para persistir em refresh e compartilhamento de link.
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFiltersFromParams(searchParams), [searchParams]);
  const setFilters = useCallback(
    (next: LancamentosFilters) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          writeFiltersToParams(params, next);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const patchFilters = useCallback(
    (patch: Partial<LancamentosFilters>) => setFilters({ ...filters, ...patch }),
    [filters, setFilters]
  );

  const [newTipo, setNewTipo] = useState<TipoLancamento | null>(null);
  const [newTransferencia, setNewTransferencia] = useState(false);
  const [importar, setImportar] = useState(false);

  const queryClient = useQueryClient();
  const invalidate = () => invalidateLancamentos(queryClient);

  const { resumo, isLoading: loadingResumo } = useLancamentosResumo(filters);

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Lançamentos</h2>
          <p className="text-sm text-muted-foreground">
            Vendo <span className="font-medium text-foreground">{recorteLabel(filters)}</span> · por vencimento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full gap-1 border-positive text-positive-strong hover:bg-positive/10"
            onClick={() => setNewTipo("receita")}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova receita
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full gap-1 border-danger-mid text-danger-mid hover:bg-danger-soft"
            onClick={() => setNewTipo("despesa")}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova despesa
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full gap-1 border-info-mid text-info-mid hover:bg-info-soft"
            onClick={() => setNewTransferencia(true)}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transferência
          </Button>
          <Button size="sm" variant="outline" className="h-9 rounded-full gap-1" onClick={() => setImportar(true)}>
            <Upload className="h-3.5 w-3.5" />
            Importar
          </Button>
        </div>
      </div>

      {/* KPIs clicáveis: cada um aplica o filtro correspondente. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Recebido"
          value={resumo.recebido}
          icon={TrendingUp}
          tone="positive"
          loading={loadingResumo}
          onClick={() => patchFilters({ tipo: "receita", status: "pagos" })}
        />
        <KPICard
          label="Pago"
          value={resumo.pago}
          icon={TrendingDown}
          tone="danger"
          loading={loadingResumo}
          onClick={() => patchFilters({ tipo: "despesa", status: "pagos" })}
        />
        <KPICard
          label="A receber"
          value={resumo.aReceber}
          icon={Clock}
          tone="info"
          loading={loadingResumo}
          onClick={() => patchFilters({ tipo: "receita", status: "pendentes" })}
        />
        <KPICard
          label="A pagar"
          value={resumo.aPagar}
          icon={Clock}
          tone="warning"
          loading={loadingResumo}
          subtitle={resumo.atrasadosCount > 0 ? `${resumo.atrasadosCount} atrasado(s)` : undefined}
          subtitleTone="danger"
          onClick={() => patchFilters({ tipo: "despesa", status: "pendentes" })}
        />
      </div>

      <Card className="rounded-2xl border border-black/5 bg-white p-4">
        <CardContent className="p-0">
          <LancamentosTable
            resumo={resumo}
            filters={filters}
            onFiltersChange={setFilters}
            onMutated={invalidate}
          />

          {newTipo && (
            <LancamentoFormDialog
              open
              onOpenChange={(v) => !v && setNewTipo(null)}
              tipo={newTipo}
              onSaved={() => {
                setNewTipo(null);
                invalidate();
              }}
            />
          )}

          <TransferenciaFormDialog
            open={newTransferencia}
            onOpenChange={setNewTransferencia}
            onSaved={() => {
              setNewTransferencia(false);
              invalidate();
            }}
          />

          <ImportarLancamentosDialog
            open={importar}
            onOpenChange={setImportar}
            onImported={invalidate}
          />
        </CardContent>
      </Card>
    </div>
  );
}

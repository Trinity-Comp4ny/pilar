import { FiltroPeriodo } from "@/components/filters/FiltroPeriodo";
import { cn } from "@/lib/utils";
import { useFinanceFilter } from "../hooks/useFinanceFilter";

// Apenas estas abas são regidas pelo período do header. As demais têm filtros
// próprios (Lançamentos, Folha) ou não usam período (Faturas, Contas).
const TABS_WITH_PERIOD = new Set(["visao-geral"]);

/**
 * Seletor de período do Financeiro no header (spec 006, padronizado na spec 024).
 * Só embrulha o FiltroPeriodo compartilhado com o estado do contexto e, na Visão
 * Geral, injeta o toggle Diário/Mensal no rodapé do popover.
 */
export function PeriodoPopover({ activeTab }: { activeTab?: string }) {
  const { dateFrom, setDateFrom, dateTo, setDateTo, visualizacao, setVisualizacao } = useFinanceFilter();

  if (activeTab && !TABS_WITH_PERIOD.has(activeTab)) return null;
  const showVisualizacao = !activeTab || activeTab === "visao-geral";

  return (
    <FiltroPeriodo
      from={dateFrom}
      to={dateTo}
      onChange={(from, to) => {
        setDateFrom(from);
        setDateTo(to);
      }}
      footer={
        showVisualizacao ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-xs text-black/50">Agrupar por</span>
            <div className="inline-flex rounded-full bg-black/[0.04] p-0.5">
              {(["dia", "mes"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisualizacao(v)}
                  className={cn(
                    "px-3 h-7 rounded-full text-xs transition-colors",
                    visualizacao === v ? "bg-white shadow-sm text-ink font-medium" : "text-black/50 hover:text-ink"
                  )}
                >
                  {v === "dia" ? "Diário" : "Mensal"}
                </button>
              ))}
            </div>
          </div>
        ) : undefined
      }
    />
  );
}

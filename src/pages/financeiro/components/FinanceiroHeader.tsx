import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear, endOfYear, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanceFilter } from "../hooks/useFinanceFilter";

type PresetKey = "this-month" | "last-month" | "last-30" | "this-year" | "custom";

function rangeForPreset(preset: PresetKey): { from: Date; to: Date } | null {
  const now = new Date();
  if (preset === "this-month") return { from: startOfMonth(now), to: endOfMonth(now) };
  if (preset === "last-month") {
    const last = subMonths(now, 1);
    return { from: startOfMonth(last), to: endOfMonth(last) };
  }
  if (preset === "last-30") return { from: subDays(now, 30), to: now };
  if (preset === "this-year") return { from: startOfYear(now), to: endOfYear(now) };
  return null;
}

function detectPreset(from: Date | undefined, to: Date | undefined): PresetKey {
  if (!from || !to) return "custom";
  const sameAs = (k: Exclude<PresetKey, "custom">) => {
    const r = rangeForPreset(k);
    return !!r && isSameDay(r.from, from) && isSameDay(r.to, to);
  };
  if (sameAs("this-month")) return "this-month";
  if (sameAs("last-month")) return "last-month";
  if (sameAs("last-30")) return "last-30";
  if (sameAs("this-year")) return "this-year";
  return "custom";
}

// Apenas estas abas são regidas pelo "Período:" do header.
// As demais têm filtros próprios (Lançamentos, Folha) ou não usam período (Faturas, Contas).
const TABS_WITH_PERIOD = new Set(["visao-geral", "fluxo-caixa"]);

export function FinanceiroHeader({ activeTab }: { activeTab?: string }) {
  const { dateFrom, setDateFrom, dateTo, setDateTo, visualizacao, setVisualizacao } = useFinanceFilter();
  const { isMobile } = useSidebar();
  const filterType = useMemo(() => detectPreset(dateFrom, dateTo), [dateFrom, dateTo]);
  const showPeriod = !activeTab || TABS_WITH_PERIOD.has(activeTab);
  // O toggle Diário/Mensal só afeta a Visão Geral; no Fluxo de Caixa era inerte.
  const showVisualizacao = !activeTab || activeTab === "visao-geral";

  const handleFilterChange = (value: string) => {
    if (value === "custom") return;
    const range = rangeForPreset(value as PresetKey);
    if (range) {
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-white border-b shadow-sm w-full">
      <div className="px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {isMobile && (
              <SidebarTrigger className="mt-0.5 text-black/80 hover:text-brand hover:bg-black/5 transition-colors rounded-full h-9 w-9" />
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Financeiro</h1>
              <p className="text-sm text-muted-foreground mt-1">Gerencie receitas e despesas</p>
            </div>

          </div>

          {showPeriod && (
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Período:</span>

              <Select value={filterType} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[170px] h-9 text-sm rounded-full">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">Este mês</SelectItem>
                  <SelectItem value="last-month">Mês passado</SelectItem>
                  <SelectItem value="last-30">Últimos 30 dias</SelectItem>
                  <SelectItem value="this-year">Este ano</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {filterType === "custom" && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-left-5 duration-300">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal text-sm h-9 min-w-[130px] rounded-full",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal text-sm h-9 min-w-[130px] rounded-full",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {showVisualizacao && (
                <div className="inline-flex rounded-full bg-muted p-0.5 ml-1">
                  {(["dia", "mes"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisualizacao(v)}
                      className={cn(
                        "px-3 h-9 sm:h-8 rounded-full text-xs transition-colors",
                        visualizacao === v
                          ? "bg-white shadow-sm text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {v === "dia" ? "Diário" : "Mensal"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

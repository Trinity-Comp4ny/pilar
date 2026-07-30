import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear, endOfYear, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useFinanceFilter } from "../hooks/useFinanceFilter";

type PresetKey = "this-month" | "last-month" | "last-30" | "this-year" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "Este mês" },
  { key: "last-month", label: "Mês passado" },
  { key: "last-30", label: "Últimos 30 dias" },
  { key: "this-year", label: "Este ano" },
  { key: "custom", label: "Personalizado" },
];

// Apenas estas abas são regidas pelo período do header. As demais têm filtros
// próprios (Lançamentos, Folha) ou não usam período (Faturas, Contas).
const TABS_WITH_PERIOD = new Set(["visao-geral", "fluxo-caixa"]);

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

/**
 * Seletor de período compacto do Financeiro (spec 006). Um botão-popover que
 * cabe no header fino: presets à esquerda, calendário de intervalo à direita e,
 * na Visão Geral, o toggle Diário/Mensal no rodapé. Some nas abas sem período.
 */
export function PeriodoPopover({ activeTab }: { activeTab?: string }) {
  const { dateFrom, setDateFrom, dateTo, setDateTo, visualizacao, setVisualizacao } = useFinanceFilter();
  const preset = useMemo(() => detectPreset(dateFrom, dateTo), [dateFrom, dateTo]);

  if (activeTab && !TABS_WITH_PERIOD.has(activeTab)) return null;
  const showVisualizacao = !activeTab || activeTab === "visao-geral";

  const triggerLabel =
    preset === "custom"
      ? dateFrom && dateTo
        ? `${format(dateFrom, "dd/MM")} – ${format(dateTo, "dd/MM")}`
        : "Personalizado"
      : (PRESETS.find((p) => p.key === preset)?.label ?? "Período");

  const applyPreset = (key: PresetKey) => {
    // "custom" mantém o intervalo atual e deixa o usuário ajustar no calendário.
    if (key === "custom") return;
    const r = rangeForPreset(key);
    if (r) {
      setDateFrom(r.from);
      setDateTo(r.to);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="rounded-full h-9 px-3.5 text-[13px] font-normal gap-1.5">
          <CalendarDays size={14} className="text-black/50" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          <div className="flex flex-col gap-0.5 p-2 border-r border-black/5 min-w-[152px]">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={cn(
                  "text-left text-[13px] px-3 py-1.5 rounded-lg transition-colors",
                  preset === p.key ? "bg-brand/15 text-ink font-medium" : "text-black/70 hover:bg-black/[0.04]"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Calendar
            mode="range"
            selected={dateFrom ? { from: dateFrom, to: dateTo } : undefined}
            onSelect={(r) => {
              setDateFrom(r?.from);
              setDateTo(r?.to);
            }}
            numberOfMonths={1}
            locale={ptBR}
            initialFocus
          />
        </div>

        {showVisualizacao && (
          <div className="flex items-center justify-between gap-2 border-t border-black/5 px-3 py-2">
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
        )}
      </PopoverContent>
    </Popover>
  );
}

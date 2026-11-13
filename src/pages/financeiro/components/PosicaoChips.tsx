import { cn } from "@/lib/utils";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import type { BaldePosicao, TitulosPosicao } from "../hooks/useTitulosPosicao";

interface Props {
  tipo: "receita" | "despesa";
  posicao: TitulosPosicao | undefined;
  loading: boolean;
  ativo: BaldePosicao | null;
  onSelect: (b: BaldePosicao) => void;
}

/**
 * Posição dos títulos em chips clicáveis (SPEC 150): o que o dono pergunta toda manhã,
 * "o que venceu, o que vence hoje e nesta semana". Cada chip aplica o filtro e mostra
 * quantidade e valor do conjunto inteiro. Rola na horizontal no celular.
 */
export function PosicaoChips({ tipo, posicao, loading, ativo, onSelect }: Props) {
  const formatCurrency = useMoneyMask();
  const itens: { balde: BaldePosicao; label: string; tom: "danger" | "warning" | "info" | "neutral" | "positive" }[] = [
    { balde: "vencidos", label: "Vencidos", tom: "danger" },
    { balde: "hoje", label: "Vencem hoje", tom: "warning" },
    { balde: "semana", label: "Próximos 7 dias", tom: "info" },
    { balde: "futuro", label: "A vencer", tom: "neutral" },
    { balde: "pagos_mes", label: tipo === "receita" ? "Recebidos no mês" : "Pagos no mês", tom: "positive" },
  ];

  return (
    <div
      role="group"
      aria-label={tipo === "receita" ? "Posição do que há a receber" : "Posição do que há a pagar"}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none"
    >
      {itens.map(({ balde, label, tom }) => {
        const v = posicao?.baldes[balde];
        const selecionado = ativo === balde;
        const vazio = !loading && (v?.qtd ?? 0) === 0;
        return (
          <button
            key={balde}
            type="button"
            aria-pressed={selecionado}
            onClick={() => onSelect(balde)}
            className={cn(
              "flex min-w-40 shrink-0 flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              selecionado ? "border-brand bg-brand text-ink" : "border-border bg-background hover:bg-muted/50",
              vazio && !selecionado && "opacity-60"
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 rounded-full",
                  tom === "danger" && "bg-fill-danger",
                  tom === "warning" && "bg-fill-warning",
                  tom === "info" && "bg-chart-info",
                  tom === "neutral" && "bg-muted-foreground",
                  tom === "positive" && "bg-positive"
                )}
              />
              {label}
              <span className={cn("tabular-nums", selecionado ? "text-white/70" : "text-muted-foreground")}>
                {loading ? "…" : (v?.qtd ?? 0)}
              </span>
            </span>
            <span className="text-[15px] font-semibold tabular-nums">
              {loading ? "—" : formatCurrency(v?.valor ?? 0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

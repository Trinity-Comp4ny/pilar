import { useMemo } from "react";
// Valor real, sem a máscara de "ocultar valores": é um relatório para o cliente e vai para o papel.
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { achatarOrcado, montarOrcadoRealizado, type NoFinanceiro } from "@/pages/obras/lib/orcadoRealizado";

export interface LinhaDoRelatorio extends Omit<NoFinanceiro, "created_at"> {
  previsto: number;
  /** Despesa lançada neste nó (sem somar os filhos). */
  realizado: number;
}

/**
 * Orçado x realizado em leitura, linha por linha (fase, etapa e serviço): o relatório que o escritório mostra ao
 * dono da obra e que o portal exibe. Sem campos de edição. O realizado é o que o gestor confirmou para o cliente.
 */
export function RelatorioOrcadoRealizado({
  linhas,
  semFrente = 0,
  className,
}: {
  linhas: ReadonlyArray<LinhaDoRelatorio>;
  /** Despesa confirmada que não está ligada a nenhuma fase, etapa ou serviço. */
  semFrente?: number;
  className?: string;
}) {
  const arvore = useMemo(() => {
    const nos = linhas.map((l) => ({ ...l, created_at: "" }));
    const previsto = new Map(linhas.map((l) => [l.id, l.previsto]));
    const realizado = Object.fromEntries(linhas.map((l) => [l.id, l.realizado]));
    return montarOrcadoRealizado(nos, previsto, realizado, semFrente);
  }, [linhas, semFrente]);
  const todas = useMemo(() => achatarOrcado(arvore.raizes), [arvore]);

  if (todas.length === 0 && semFrente === 0) {
    return <p className="text-sm text-muted-foreground">O cronograma desta obra ainda não tem itens.</p>;
  }

  const saldoTotal = arvore.totalPrevisto - arvore.totalRealizado;
  const grid =
    "grid grid-cols-[minmax(0,1fr)_92px_92px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_112px_112px_112px]";

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-white text-sm", className)}>
      <div
        className={cn(
          grid,
          "border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        )}
      >
        <span>Item</span>
        <span className="text-right">Orçado</span>
        <span className="text-right">Realizado</span>
        <span className="hidden text-right sm:block">Saldo</span>
      </div>
      {todas.map((l) => {
        const saldo = l.previsto - l.realizado;
        const estourou = l.previsto > 0 && l.realizado > l.previsto;
        return (
          <div
            key={l.no.id}
            className={cn(grid, "border-b px-3 py-1.5", l.nivel === "fase" && "bg-muted/30 font-semibold")}
          >
            <span className="min-w-0 truncate text-ink" style={{ paddingLeft: l.profundidade * 14 }} title={l.caminho}>
              {l.no.nome}
            </span>
            <span className="text-right tabular-nums text-muted-foreground">
              {l.previsto > 0 ? formatCurrency(l.previsto) : "—"}
            </span>
            <span className={cn("text-right tabular-nums", estourou ? "text-danger-strong" : "text-ink")}>
              {l.realizado > 0 ? formatCurrency(l.realizado) : "—"}
            </span>
            <span
              className={cn(
                "hidden text-right tabular-nums sm:block",
                l.previsto > 0 && saldo < 0 ? "text-danger-strong" : "text-muted-foreground"
              )}
            >
              {l.previsto > 0 ? formatCurrency(saldo) : "—"}
            </span>
          </div>
        );
      })}
      {semFrente > 0 && (
        <div className={cn(grid, "border-b px-3 py-1.5")}>
          <span className="text-muted-foreground">Sem item do cronograma</span>
          <span className="text-right text-muted-foreground">—</span>
          <span className="text-right tabular-nums text-ink">{formatCurrency(semFrente)}</span>
          <span className="hidden sm:block" />
        </div>
      )}
      <div className={cn(grid, "bg-muted/40 px-3 py-2 font-semibold")}>
        <span className="text-ink">Total da obra</span>
        <span className="text-right tabular-nums">
          {arvore.totalPrevisto > 0 ? formatCurrency(arvore.totalPrevisto) : "—"}
        </span>
        <span className="text-right tabular-nums">{formatCurrency(arvore.totalRealizado)}</span>
        <span
          className={cn(
            "hidden text-right tabular-nums sm:block",
            arvore.totalPrevisto > 0 && saldoTotal < 0 ? "text-danger-strong" : "text-ink"
          )}
        >
          {arvore.totalPrevisto > 0 ? formatCurrency(saldoTotal) : "—"}
        </span>
      </div>
    </div>
  );
}

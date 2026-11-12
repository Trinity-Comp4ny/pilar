import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface KpiResumoItem {
  texto: string;
  /** Pinta o item de alerta (ex.: "3 em atraso" quando passa de zero). */
  alerta?: boolean;
}

/**
 * Indicadores numa linha só ("14 ativos · 2 em atraso · R$ 530 mil em pipeline"), para o
 * `resumo` do `CollapsibleKpiSection`: recolher a faixa não esconde os números
 * (auditoria de espaço, 2026-11).
 */
export function KpiResumo({ itens }: { itens: KpiResumoItem[] }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
      {itens.map((item, i) => (
        <Fragment key={item.texto}>
          {i > 0 && <span aria-hidden>·</span>}
          <span className={cn("whitespace-nowrap", item.alerta && "font-medium text-danger-strong")}>{item.texto}</span>
        </Fragment>
      ))}
    </span>
  );
}

import { Check, ChevronDown, ChevronRight, ArrowDownCircle, ArrowUpCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { formatDateDisplay } from "@/lib/dateUtils";
import type { Lancamento } from "../hooks/useLancamentosUnified";
import type { GrupoParcelaResumo } from "../hooks/useGruposParcelaResumo";

interface Props {
  groupId: string;
  items: Lancamento[];
  /** Resumo do PLANO inteiro (independe do período). Ausente enquanto carrega. */
  resumo?: GrupoParcelaResumo;
  isExpanded: boolean;
  canEdit: boolean;
  selected: Set<string>;
  cellPad: string;
  cellTextSize: string;
  measureRef: (el: Element | null) => void;
  dataIndex: number;
  isPaidStatus: (l: Lancamento) => boolean;
  rowKey: (l: Lancamento) => string;
  stripParcelaSuffix: (desc: string) => string;
  onToggle: () => void;
  onToggleSelection: (items: Lancamento[]) => void;
  onMarkPaid: (items: Lancamento[]) => void;
  onDeleteGroup: (items: Lancamento[]) => void;
}

const STATUS_LABEL: Record<GrupoParcelaResumo["status"], string> = {
  aberto: "Em aberto",
  parcial: "Parcial",
  quitado: "Quitado",
};

export function LancamentosGroupRow({
  groupId,
  items,
  resumo,
  isExpanded,
  canEdit,
  selected,
  cellPad,
  cellTextSize,
  measureRef,
  dataIndex,
  isPaidStatus,
  rowKey,
  stripParcelaSuffix,
  onToggle,
  onToggleSelection,
  onMarkPaid,
  onDeleteGroup,
}: Props) {
  const first = items[0];
  const isReceita = first.tipo === "receita";
  const groupDesc = stripParcelaSuffix(first.descricao);
  const groupAllSelected = items.every((i) => selected.has(rowKey(i)));
  const groupSomeSelected = items.some((i) => selected.has(rowKey(i)));

  // Fonte da verdade = resumo do plano (RPC). Fallback para o visível enquanto carrega.
  const totalPlano = resumo?.totalOriginal ?? items.reduce((s, i) => s + i.valor, 0);
  const saldo = resumo?.saldo ?? items.filter((i) => !isPaidStatus(i)).reduce((s, i) => s + i.valor, 0);
  const pagas = resumo?.pagas ?? items.filter(isPaidStatus).length;
  const totalParcelas = resumo?.totalParcelas ?? first.parcela_total ?? items.length;
  const status = resumo?.status ?? (pagas === 0 ? "aberto" : pagas < totalParcelas ? "parcial" : "quitado");

  const parcelaLabel = `${pagas} de ${totalParcelas} pagas`;
  const proximaLabel =
    status === "quitado"
      ? "quitado"
      : resumo?.proximaVenc
        ? `vence ${formatDateDisplay(resumo.proximaVenc)}`
        : "—";

  return (
    <tr
      key={`group-${groupId}`}
      data-index={dataIndex}
      ref={measureRef}
      className="border-b border-black/5 hover:bg-muted cursor-pointer transition-colors bg-muted/50"
      onClick={onToggle}
    >
      {canEdit && (
        <td className={cellPad} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={groupAllSelected ? true : groupSomeSelected ? "indeterminate" : false}
            onCheckedChange={() => onToggleSelection(items)}
            aria-label="Selecionar grupo"
          />
        </td>
      )}
      <td className={cellPad}>
        <span
          className={cn(
            "inline-flex items-center justify-center h-7 w-7 rounded-full",
            isReceita ? "bg-positive/10 text-positive-strong" : "bg-negative/10 text-negative-strong"
          )}
        >
          {isReceita ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
        </span>
      </td>
      <td className={cn(cellPad, cellTextSize, "text-muted-foreground whitespace-nowrap")}>{proximaLabel}</td>
      <td className={cn(cellPad, "font-semibold", cellTextSize)}>
        <span className="inline-flex items-center gap-1.5">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          {groupDesc}
        </span>
      </td>
      <td className={cn(cellPad, cellTextSize)}>{first.contraparte_nome || "-"}</td>
      <td className={cn(cellPad, cellTextSize)}>{first.categoria_nome || "-"}</td>
      <td className={cn(cellPad, cellTextSize)}>{first.projeto_codigo || "-"}</td>
      <td className={cn(cellPad, "text-xs text-muted-foreground whitespace-nowrap")}>{parcelaLabel}</td>
      <td className={cn(cellPad, "text-right tabular-nums", cellTextSize)}>
        <div className={cn("font-semibold", isReceita ? "text-positive-strong" : "text-negative-strong")}>
          {isReceita ? "+" : "−"} {formatCurrency(totalPlano)}
        </div>
        {status !== "quitado" && saldo > 0 && (
          <div className="text-[11px] text-muted-foreground">falta {formatCurrency(saldo)}</div>
        )}
      </td>
      <td className={cellPad}>
        <Badge
          variant="secondary"
          className={cn(
            "text-xs",
            status === "quitado" && isReceita && "bg-positive text-white",
            status === "quitado" && !isReceita && "bg-negative text-white",
            status === "parcial" && "bg-warning-soft text-warning-strong"
          )}
        >
          {STATUS_LABEL[status]}
        </Badge>
      </td>
      <td className={cellPad} onClick={(e) => e.stopPropagation()}>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Mais opções">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem className="text-xs gap-2" onSelect={() => onMarkPaid(items)}>
                <Check className="h-3.5 w-3.5 text-positive-strong" />
                Marcar todas como pagas
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs gap-2 text-danger-mid focus:text-danger-mid"
                onSelect={() => onDeleteGroup(items)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir grupo inteiro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}

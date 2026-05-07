import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Check, Pencil, Trash2 } from "lucide-react";
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
import { formatDateDisplay } from "@/lib/dateUtils";
import type { Lancamento } from "../hooks/useLancamentosUnified";

interface Props {
  l: Lancamento;
  isChild: boolean;
  isSel: boolean;
  canEdit: boolean;
  cellPad: string;
  cellTextSize: string;
  measureRef: (el: Element | null) => void;
  dataIndex: number;
  isPaidStatus: (l: Lancamento) => boolean;
  isOverdue: (l: Lancamento) => boolean;
  getDisplayDate: (efetivacao: string | null | undefined, vencimento: string | null | undefined, status: string) => string | null | undefined;
  rowKey: (l: Lancamento) => string;
  onToggleRow: (l: Lancamento) => void;
  onRowClick: (l: Lancamento) => void;
  onEdit: (l: Lancamento) => void;
  onDelete: (l: Lancamento) => void;
  onStatusChange: (l: Lancamento, s: string) => void;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function StatusBadge({
  l,
  canEdit,
  isPaidStatus,
  isOverdue,
  onChange,
}: {
  l: Lancamento;
  canEdit: boolean;
  isPaidStatus: (l: Lancamento) => boolean;
  isOverdue: (l: Lancamento) => boolean;
  onChange: (s: string) => void;
}) {
  const isReceita = l.tipo === "receita";
  const isTransf = l.tipo === "transferencia";
  const paid = isPaidStatus(l);
  const overdue = isOverdue(l);

  const options: { value: string; label: string }[] = isTransf
    ? [
        { value: "Concluída", label: "Concluída" },
        { value: "Pendente", label: "Pendente" },
      ]
    : isReceita
      ? [
          { value: "Pendente", label: "Pendente" },
          { value: "Recebido", label: "Recebido" },
        ]
      : [
          { value: "Pendente", label: "Pendente" },
          { value: "Pago", label: "Pago" },
        ];

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs cursor-pointer transition-colors",
        paid && isReceita && "bg-positive text-white hover:bg-positive/90",
        paid && !isReceita && !isTransf && "bg-red-600 text-white hover:bg-red-600/90",
        paid && isTransf && "bg-blue-600 text-white hover:bg-blue-600/90",
        !paid && overdue && "bg-amber-100 text-amber-800 hover:bg-amber-200"
      )}
    >
      {overdue && !paid ? "Atrasado" : l.status}
    </Badge>
  );

  if (!canEdit) return badge;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{badge}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="text-xs">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onChange(o.value)} className="text-xs">
            <Check className={cn("h-3 w-3 mr-1.5", l.status === o.value ? "opacity-100" : "opacity-0")} />
            {o.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-[10px] text-muted-foreground">
          Click rápido para alterar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LancamentosItemRow({
  l,
  isChild,
  isSel,
  canEdit,
  cellPad,
  cellTextSize,
  measureRef,
  dataIndex,
  isPaidStatus,
  isOverdue,
  getDisplayDate,
  rowKey,
  onToggleRow,
  onRowClick,
  onEdit,
  onDelete,
  onStatusChange,
}: Props) {
  const isReceita = l.tipo === "receita";
  const isTransf = l.tipo === "transferencia";
  const dataExibir = getDisplayDate(l.data_efetivacao, l.data_vencimento, l.status);
  const overdue = isOverdue(l);
  const k = rowKey(l);

  return (
    <tr
      key={k}
      data-index={dataIndex}
      ref={measureRef}
      className={cn(
        "border-b border-black/5 hover:bg-gray-50 cursor-pointer transition-colors",
        isSel && "bg-brand/5",
        isTransf && "bg-blue-50/30",
        isChild && "bg-white"
      )}
      onClick={() => onRowClick(l)}
    >
      {canEdit && (
        <td className={cellPad} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSel}
            onCheckedChange={() => onToggleRow(l)}
            aria-label="Selecionar linha"
          />
        </td>
      )}
      <td className={cn(cellPad, isChild && "pl-8")}>
        <span
          className={cn(
            "inline-flex items-center justify-center h-7 w-7 rounded-full",
            isTransf
              ? "bg-blue-100 text-blue-600"
              : isReceita
                ? "bg-positive/10 text-positive"
                : "bg-red-50 text-red-600"
          )}
          title={isTransf ? "Transferência" : isReceita ? "Receita" : "Despesa"}
        >
          {isTransf ? (
            <ArrowLeftRight className="h-4 w-4" />
          ) : isReceita ? (
            <ArrowUpCircle className="h-4 w-4" />
          ) : (
            <ArrowDownCircle className="h-4 w-4" />
          )}
        </span>
      </td>
      <td className={cn(cellPad, cellTextSize, overdue && "text-red-600 font-medium")}>
        {formatDateDisplay(dataExibir)}
        {overdue && <span className="ml-1 text-[10px] uppercase">atrasado</span>}
      </td>
      <td className={cn(cellPad, "font-medium", cellTextSize)}>
        {l.descricao}
        {isTransf && l.conta_nome && (
          <span className="ml-1 text-[10px] text-muted-foreground font-normal">({l.conta_nome})</span>
        )}
      </td>
      <td className={cn(cellPad, cellTextSize)}>
        {isTransf ? (l.contraparte_nome ?? "-") : l.contraparte_nome || "-"}
      </td>
      <td className={cn(cellPad, cellTextSize)}>{isTransf ? "-" : l.categoria_nome || "-"}</td>
      <td className={cn(cellPad, cellTextSize)}>{isTransf ? "-" : l.projeto_codigo || "-"}</td>
      <td className={cn(cellPad, "text-xs text-muted-foreground")}>
        {isTransf
          ? "-"
          : l.parcela_numero && l.parcela_total
            ? `${l.parcela_numero}/${l.parcela_total}`
            : "1/1"}
      </td>
      <td
        className={cn(
          cellPad,
          "text-right font-semibold tabular-nums",
          cellTextSize,
          isTransf ? "text-blue-600" : isReceita ? "text-positive" : "text-red-600"
        )}
      >
        {isTransf ? "⇄" : isReceita ? "+" : "−"} {formatBRL(l.valor)}
      </td>
      <td className={cellPad} onClick={(e) => e.stopPropagation()}>
        <StatusBadge
          l={l}
          canEdit={canEdit}
          isPaidStatus={isPaidStatus}
          isOverdue={isOverdue}
          onChange={(s) => onStatusChange(l, s)}
        />
      </td>
      <td className={cellPad} onClick={(e) => e.stopPropagation()}>
        {canEdit && (
          <div className="flex gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:bg-blue-50"
              onClick={() => onEdit(l)}
              aria-label="Editar lançamento"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:bg-red-50"
              onClick={() => onDelete(l)}
              aria-label="Excluir lançamento"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

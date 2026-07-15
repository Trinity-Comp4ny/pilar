import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  canEdit: boolean;
  onMarkPaid: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function LancamentosBulkBar({ count, canEdit, onMarkPaid, onDelete, onClear }: Props) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand bg-brand/5 px-3 py-2 text-xs">
      <span className="font-medium">
        {count} selecionado{count > 1 ? "s" : ""}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onMarkPaid}
            className="h-7 text-xs gap-1 bg-white border-positive text-positive-strong hover:bg-positive/10"
          >
            <Check className="h-3 w-3" />
            Marcar pago/recebido
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="h-7 text-xs gap-1 bg-white border-red-300 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" />
            Excluir
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 text-xs text-muted-foreground gap-1"
        >
          <X className="h-3 w-3" />
          Limpar seleção
        </Button>
      </div>
    </div>
  );
}

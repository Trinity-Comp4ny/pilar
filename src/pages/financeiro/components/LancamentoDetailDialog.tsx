import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowDownCircle, ArrowUpCircle, ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateDisplay } from "@/lib/dateUtils";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import type { Lancamento } from "../hooks/useLancamentosUnified";
import { GrupoParcelaActions } from "./GrupoParcelaActions";

interface Props {
  lancamento: Lancamento | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDelete: (l: Lancamento) => void;
  onEditInTab: (l: Lancamento) => void;
  onGroupChanged?: () => void;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export function LancamentoDetailDialog({
  lancamento: l,
  open,
  onOpenChange,
  onDelete,
  onEditInTab,
  onGroupChanged,
}: Props) {
  const { canEdit } = useFeatureAccess("financeiro");
  if (!l) return null;

  const isReceita = l.tipo === "receita";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full",
                isReceita ? "bg-positive/10 text-positive-strong" : "bg-negative/10 text-negative-strong"
              )}
            >
              {isReceita ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
            </span>
            Detalhes — {isReceita ? "Receita" : "Despesa"}
          </DialogTitle>
          <DialogDescription>{l.descricao}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <Field label="Valor">
            <span className={cn("font-bold", isReceita ? "text-positive-strong" : "text-negative-strong")}>
              {isReceita ? "+" : "−"} {formatBRL(l.valor)}
            </span>
          </Field>
          <Field label="Status">
            <Badge variant="secondary">{l.status}</Badge>
          </Field>
          <Field label="Vencimento">{formatDateDisplay(l.data_vencimento)}</Field>
          <Field label={isReceita ? "Recebimento" : "Pagamento"}>
            {l.data_efetivacao ? formatDateDisplay(l.data_efetivacao) : "—"}
          </Field>
          <Field label="Categoria">{l.categoria_nome || "—"}</Field>
          <Field label="Projeto">{l.projeto_codigo || "—"}</Field>
          <Field label={isReceita ? "Cliente" : "Fornecedor"}>{l.contraparte_nome || "—"}</Field>
          <Field label="Forma pagto.">{l.forma_pagamento || "—"}</Field>
          <Field label="Parcela">
            {l.parcela_numero && l.parcela_total ? `${l.parcela_numero}/${l.parcela_total}` : "1/1"}
          </Field>
        </div>

        {l.grupo_parcela && canEdit && (
          <div className="pt-3">
            <GrupoParcelaActions
              lancamento={l}
              onChanged={() => {
                onGroupChanged?.();
                onOpenChange(false);
              }}
            />
          </div>
        )}

        {canEdit && (
          <div className="flex items-center gap-2 pt-4 border-t mt-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => onEditInTab(l)}>
              <ExternalLink className="h-4 w-4" />
              Editar em {isReceita ? "Receitas" : "Despesas"}
            </Button>
            <Button variant="destructive" className="gap-2" onClick={() => onDelete(l)}>
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="text-sm mt-0.5">{children}</div>
    </div>
  );
}

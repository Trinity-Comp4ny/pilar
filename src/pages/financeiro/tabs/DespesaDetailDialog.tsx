import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { formatDateDisplay } from "@/lib/dateUtils";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getFaturaLabel(despesa: Despesa, cartoes: ContaLookup[]): string | null {
  if (!despesa.cartao_id) return null;
  const cartao = cartoes.find((c) => c.id === despesa.cartao_id);
  if (!cartao) return null;
  const diaFechamento = cartao.dia_fechamento ?? 31;
  const dt = new Date(despesa.data_vencimento + "T00:00:00");
  let mes = dt.getMonth() + 1;
  let ano = dt.getFullYear();
  if (dt.getDate() > diaFechamento) {
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }
  return `${MESES_ABREV[mes - 1]}/${ano}`;
}

export interface Despesa {
  id: string;
  data_vencimento: string;
  data_pagamento?: string;
  descricao: string;
  categoria_id: string | null;
  categoria_nome?: string;
  valor: number;
  status: string;
  projeto_id: string | null;
  projeto_codigo?: string;
  nota_fiscal: string | null;
  conta_id: string | null;
  cartao_id: string | null;
  observacao: string | null;
  fornecedor_id: string | null;
  fornecedor_nome?: string;
  forma_pagamento?: string;
  created_by?: string;
  grupo_parcela?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
}

interface ContaLookup {
  id: string;
  nome: string;
  dia_fechamento?: number;
}

interface DespesaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  despesa: Despesa | null;
  contas: ContaLookup[];
  cartoes: ContaLookup[];
  canEdit: boolean;
  onEdit: (despesa: Despesa) => void;
  onDelete: (id: string) => void;
}

export function DespesaDetailDialog({
  open,
  onOpenChange,
  despesa,
  contas,
  cartoes,
  canEdit,
  onEdit,
  onDelete,
}: DespesaDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes da Despesa</DialogTitle>
          <DialogDescription>Informações completas da despesa selecionada</DialogDescription>
        </DialogHeader>

        {despesa && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Data Vencimento</Label>
                <p className="text-sm font-medium">{formatDateDisplay(despesa.data_vencimento)}</p>
              </div>
              {despesa.data_pagamento && despesa.data_pagamento !== despesa.data_vencimento && (
                <div>
                  <Label className="text-xs text-muted-foreground">Data Pagamento</Label>
                  <p className="text-sm font-medium text-positive-strong">{formatDateDisplay(despesa.data_pagamento)}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Valor</Label>
                <p className="text-sm font-bold text-negative-strong">
                  R$ {despesa.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <p className="text-sm font-medium">{despesa.descricao}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <p className="text-sm">{despesa.status}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <p className="text-sm">{despesa.categoria_nome || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                <p className="text-sm">{despesa.fornecedor_nome || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Projeto</Label>
                <p className="text-sm">{despesa.projeto_codigo || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Forma de Pagamento</Label>
                <p className="text-sm">{despesa.forma_pagamento || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Conta / Cartão</Label>
                <p className="text-sm">
                  {despesa.conta_id
                    ? contas.find((c) => c.id === despesa.conta_id)?.nome
                    : despesa.cartao_id
                      ? cartoes.find((c) => c.id === despesa.cartao_id)?.nome
                      : "-"}
                </p>
              </div>
              {despesa.cartao_id && (
                <div>
                  <Label className="text-xs text-muted-foreground">Fatura</Label>
                  <Badge variant="outline" className="mt-1 text-xs font-normal">
                    {getFaturaLabel(despesa, cartoes) ?? "—"}
                  </Badge>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Nota Fiscal</Label>
                <p className="text-sm">{despesa.nota_fiscal || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Parcela</Label>
                <p className="text-sm">
                  {despesa.parcela_numero && despesa.parcela_total
                    ? `${despesa.parcela_numero}/${despesa.parcela_total}`
                    : "1/1"}
                </p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Observação</Label>
                <p className="text-sm">{despesa.observacao || "-"}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4 mt-4 border-t">
              {canEdit && (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => onEdit(despesa)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      onDelete(despesa.id);
                      onOpenChange(false);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

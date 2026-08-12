import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, FileDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { FolhaItem, HistoryItem } from "../types";
import { getMonthLabel } from "../types";
import { calcularVariavel, calcularTotal, subtotalProjeto } from "../folhaCalc";

interface CloseMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: number;
  selectedYear: number;
  peopleCount: number;
  totalFolha: number;
  saving: boolean;
  onConfirm: () => void;
}

export function CloseMonthDialog({
  open,
  onOpenChange,
  selectedMonth,
  selectedYear,
  peopleCount,
  totalFolha,
  saving,
  onConfirm,
}: CloseMonthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="brand">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Fechar folha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar folha de pagamento</DialogTitle>
          <DialogDescription>
            Você está prestes a fechar a folha de{" "}
            <strong>
              {getMonthLabel(selectedMonth)}/{selectedYear}
            </strong>
            .
            <br />
            <br />
            Isso vai gerar os registros financeiros para {peopleCount} pessoas, totalizando{" "}
            <strong>{formatCurrency(totalFolha)}</strong>.
            <br />
            <br />
            Confira os valores antes de confirmar: a folha fechada guarda os valores atuais e não reflete mudanças
            futuras nos projetos deste mês.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={saving} variant="brand">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar fechamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DetailEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: FolhaItem | null;
  isEditing: boolean;
  editForm: Partial<FolhaItem>;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onEditFormChange: (field: string, value: number) => void;
}

export function DetailEditDialog({
  open,
  onOpenChange,
  person,
  isEditing,
  editForm,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onEditFormChange,
}: DetailEditDialogProps) {
  // Fórmula: variável = área × valor/m²; total = fixo + variável. Ao editar,
  // recalculamos os derivados para não fechar folha com total inconsistente.
  const salario = editForm.p_salario_fixo ?? person?.p_salario_fixo ?? 0;
  const area = editForm.soma_area ?? person?.soma_area ?? 0;
  const valorM2 = person?.p_valor_m2 ?? 0;
  const variavelCalc = calcularVariavel(area, valorM2);
  const totalCalc = calcularTotal(salario, variavelCalc);
  const totalManual = editForm.v_total;
  const totalDesacoplado = isEditing && totalManual !== undefined && Math.abs(totalManual - totalCalc) > 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar folha de pagamento" : "Detalhes da folha de pagamento"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Ajuste os valores. As alterações valem só para este mês."
              : "Informações detalhadas do colaborador."}
          </DialogDescription>
        </DialogHeader>
        {person && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <span className="text-xs font-semibold text-muted-foreground">Colaborador</span>
                <p className="font-medium">{person.p_nome}</p>
              </div>

              <EditableField
                label="Salário fixo"
                isEditing={isEditing}
                value={person.p_salario_fixo}
                editValue={editForm.p_salario_fixo}
                onChange={(v) => onEditFormChange("p_salario_fixo", v)}
                isCurrency
              />
              <EditableField
                label="Produtividade (m²)"
                isEditing={isEditing}
                value={person.soma_area}
                editValue={editForm.soma_area}
                onChange={(v) => onEditFormChange("soma_area", v)}
                suffix=" m²"
              />
              <EditableField
                label="Variável"
                isEditing={isEditing}
                value={person.v_variavel}
                editValue={isEditing ? variavelCalc : editForm.v_variavel}
                onChange={() => {}}
                isCurrency
                readOnlyWhenEditing
              />
              <EditableField
                label="Total"
                isEditing={isEditing}
                value={person.v_total}
                editValue={editForm.v_total ?? totalCalc}
                onChange={(v) => onEditFormChange("v_total", v)}
                isCurrency
                isBold
              />
            </div>

            {isEditing && (
              <p className="text-xs text-muted-foreground">
                Variável recalculado de área × {formatCurrency(valorM2)}/m². Total sugerido:{" "}
                {formatCurrency(totalCalc)}.
              </p>
            )}
            {totalDesacoplado && (
              <div className="text-xs text-warning-strong bg-warning-soft p-2 rounded">
                Total ajustado manualmente, desacoplado da fórmula (fixo + variável = {formatCurrency(totalCalc)}).
              </div>
            )}

            {/* Breakdown por projeto: de onde veio o variável. */}
            {!isEditing && person.detalhe_projetos && person.detalhe_projetos.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Variável por projeto</span>
                <div className="rounded border border-border divide-y">
                  {person.detalhe_projetos.map((p, i) => (
                    <div key={`${p.nome}-${i}`} className="flex justify-between px-2 py-1 text-sm">
                      <span className="truncate max-w-[220px]">{p.nome}</span>
                      <span className="text-muted-foreground">
                        {(p.area_m2 || 0).toLocaleString("pt-BR")} m² ={" "}
                        {formatCurrency(subtotalProjeto(p, person.p_valor_m2))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isEditing && person.edited_fields && person.edited_fields.length > 0 && (
              <div className="text-xs text-warning-strong bg-warning-soft p-2 rounded">
                * Campos editados manualmente: {person.edited_fields.join(", ")}
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={onCancelEditing}>
                Cancelar
              </Button>
              <Button onClick={onSaveEditing} variant="brand">
                Salvar alterações
              </Button>
            </>
          ) : (
            <Button onClick={onStartEditing}>Editar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditableField({
  label,
  isEditing,
  value,
  editValue,
  onChange,
  isCurrency,
  isBold,
  suffix,
  readOnlyWhenEditing,
}: {
  label: string;
  isEditing: boolean;
  value: number;
  editValue?: number;
  onChange: (v: number) => void;
  isCurrency?: boolean;
  isBold?: boolean;
  suffix?: string;
  readOnlyWhenEditing?: boolean;
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {isEditing && !readOnlyWhenEditing ? (
        <Input type="number" value={editValue} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
      ) : isEditing && readOnlyWhenEditing ? (
        <p className="text-muted-foreground">{formatCurrency(editValue ?? value)}</p>
      ) : (
        <p className={isBold ? "font-bold text-lg text-positive-strong" : ""}>
          {isCurrency ? formatCurrency(value) : `${value?.toLocaleString("pt-BR")}${suffix || ""}`}
        </p>
      )}
    </div>
  );
}

interface HistoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedHistory: HistoryItem | null;
  loading: boolean;
  items: FolhaItem[];
  onDownloadLote?: () => void;
  onDownloadComprovante?: (item: FolhaItem) => void;
}

export function HistoryDetailDialog({
  open,
  onOpenChange,
  selectedHistory,
  loading,
  items,
  onDownloadLote,
  onDownloadComprovante,
}: HistoryDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Detalhes da folha {selectedHistory && `${getMonthLabel(selectedHistory.mes)}/${selectedHistory.ano}`}
          </DialogTitle>
          <DialogDescription>Colaboradores e valores da folha selecionada.</DialogDescription>
        </DialogHeader>
        {!loading && items.length > 0 && onDownloadLote && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onDownloadLote}>
              Baixar lote de comprovantes
            </Button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado para esta folha.</p>
        ) : (
          <div className="overflow-x-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-right">Salário fixo</TableHead>
                  <TableHead className="text-right">Variável (m²)</TableHead>
                  <TableHead className="text-right">Total a receber</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Comprovante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.p_id || `${item.p_nome}-${index}`}>
                    <TableCell>
                      <div className="font-medium">{item.p_nome}</div>
                      <div className="text-xs text-muted-foreground">{item.p_cargo}</div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.p_salario_fixo)}</TableCell>
                    <TableCell className="text-right text-positive-strong font-medium">
                      {formatCurrency(item.v_variavel)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(item.v_total)}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={`capitalize text-xs px-2 py-0.5
                          ${item.status === "pago" ? "bg-positive text-ink" : ""}
                          ${item.status === "pendente" ? "bg-warning-soft text-warning-strong" : ""}
                          ${item.status === "cancelado" ? "bg-destructive text-destructive-foreground" : ""}
                        `}
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => onDownloadComprovante?.(item)}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

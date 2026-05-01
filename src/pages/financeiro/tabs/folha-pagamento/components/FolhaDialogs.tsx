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
import { Loader2, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { FolhaItem, HistoryItem } from "../types";
import { getMonthLabel } from "../types";

interface CloseMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: number;
  selectedYear: number;
  peopleCount: number;
  totalFolha: number;
  saving: boolean;
  allConfirmed: boolean;
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
  allConfirmed,
  onConfirm,
}: CloseMonthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="bg-brand hover:bg-brand/90"
          disabled={!allConfirmed}
          title={!allConfirmed ? "Confirme todos os colaboradores para fechar a folha" : ""}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Fechar Folha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar Folha de Pagamento</DialogTitle>
          <DialogDescription>
            Você está prestes a fechar a folha de{" "}
            <strong>
              {getMonthLabel(selectedMonth)}/{selectedYear}
            </strong>
            .
            <br />
            <br />
            Isso irá gerar os registros financeiros para {peopleCount} pessoas, totalizando{" "}
            <strong>{formatCurrency(totalFolha)}</strong>.
            <br />
            <br />
            Esta ação confirmará os valores atuais e não refletirá mudanças futuras nos projetos deste mês.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={saving} className="bg-brand hover:bg-brand/90">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Fechamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: FolhaItem | null;
  onConfirm: () => void;
}

export function ConfirmPersonDialog({ open, onOpenChange, person, onConfirm }: ConfirmPersonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Folha de Pagamento</DialogTitle>
          <DialogDescription>Confira os dados antes de confirmar o colaborador.</DialogDescription>
        </DialogHeader>
        {person && (
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-semibold">Colaborador: </span>
              <span>{person.p_nome}</span>
            </div>
            <div>
              <span className="font-semibold">Cargo: </span>
              <span>{person.p_cargo}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="font-semibold">Salário Fixo: </span>
              <span>{formatCurrency(person.p_salario_fixo)}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="font-semibold">Variável: </span>
              <span>{formatCurrency(person.v_variavel)}</span>
            </div>
            <div className="flex justify-between text-lg pt-1">
              <span className="font-semibold">Total a Receber: </span>
              <span className="font-bold text-positive">{formatCurrency(person.v_total)}</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="bg-brand hover:bg-brand/90">
            Confirmar Colaborador
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Folha de Pagamento" : "Detalhes da Folha de Pagamento"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Ajuste os valores manualmente. As alterações serão salvas apenas para este mês."
              : "Informações detalhadas do colaborador."}
          </DialogDescription>
        </DialogHeader>
        {person && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Colaborador</label>
                <p className="font-medium">{person.p_nome}</p>
              </div>

              <EditableField
                label="Salário Fixo"
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
                editValue={editForm.v_variavel}
                onChange={(v) => onEditFormChange("v_variavel", v)}
                isCurrency
              />
              <EditableField
                label="Total"
                isEditing={isEditing}
                value={person.v_total}
                editValue={editForm.v_total}
                onChange={(v) => onEditFormChange("v_total", v)}
                isCurrency
                isBold
              />
            </div>

            {!isEditing && person.edited_fields && person.edited_fields.length > 0 && (
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
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
              <Button onClick={onSaveEditing} className="bg-brand hover:bg-brand/90">
                Salvar Alterações
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onStartEditing}>Editar</Button>
            </>
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
}: {
  label: string;
  isEditing: boolean;
  value: number;
  editValue?: number;
  onChange: (v: number) => void;
  isCurrency?: boolean;
  isBold?: boolean;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      {isEditing ? (
        <Input type="number" value={editValue} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
      ) : (
        <p className={isBold ? "font-bold text-lg text-positive" : ""}>
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
}

export function HistoryDetailDialog({ open, onOpenChange, selectedHistory, loading, items }: HistoryDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Detalhes da Folha {selectedHistory && `${getMonthLabel(selectedHistory.mes)}/${selectedHistory.ano}`}
          </DialogTitle>
          <DialogDescription>Visualização completa dos colaboradores e valores da folha selecionada.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado para esta folha.</p>
        ) : (
          <div className="overflow-x-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Salário Fixo</TableHead>
                  <TableHead className="text-center">Produtividade</TableHead>
                  <TableHead className="text-right">Variável (m²)</TableHead>
                  <TableHead className="text-right">Total a Receber</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.p_id || `${item.p_nome}-${index}`}>
                    <TableCell>{item.p_nome}</TableCell>
                    <TableCell>{item.p_cargo}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.p_salario_fixo)}</TableCell>
                    <TableCell className="text-center">{(item.soma_area ?? 0).toLocaleString("pt-BR")} m²</TableCell>
                    <TableCell className="text-right text-positive font-medium">
                      {formatCurrency(item.v_variavel)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(item.v_total)}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={`capitalize text-xs px-2 py-0.5
                          ${item.status === "pago" ? "bg-positive/100 text-white" : ""}
                          ${item.status === "pendente" ? "bg-yellow-400 text-black" : ""}
                          ${item.status === "cancelado" ? "bg-red-500 text-white" : ""}
                        `}
                      >
                        {item.status}
                      </Badge>
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

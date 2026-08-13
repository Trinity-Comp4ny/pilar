import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { NumberInput } from "@/components/forms/NumberInput";
import { calcDisciplinasTotais, custoLinha, type DisciplinaLinha } from "../lib/disciplinasCalc";

// Catálogo padrão de disciplinas de engenharia multidisciplinar. Mantido em
// sincronia com templates/components/TemplateForm.tsx (mesma lista). O select
// aceita "Outra" para escrever uma disciplina livre.
const DISCIPLINAS_PADRAO = [
  "Arquitetônico",
  "Estrutural",
  "Estrutura Metálica",
  "Alvenaria Estrutural",
  "Elétrico",
  "Hidráulico",
  "Hidrossanitário",
  "Automação",
  "Climatização/Exaustão",
  "Gases Medicinais",
  "Sistema Fotovoltaico",
  "PPCI",
  "AVCB",
  "SPDA",
];

const OUTRA = "__outra__";

interface DisciplinasEditorProps {
  rows: DisciplinaLinha[];
  onChange: (rows: DisciplinaLinha[]) => void;
  disabled?: boolean;
}

const novaLinha = (): DisciplinaLinha => ({
  id: crypto.randomUUID(),
  disciplina: "",
  horas_estimadas: 0,
  custo_hora: 0,
  valor_venda: 0,
});

export function DisciplinasEditor({ rows, onChange, disabled }: DisciplinasEditorProps) {
  const totais = calcDisciplinasTotais(rows);

  const updateRow = (id: string, patch: Partial<DisciplinaLinha>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id));

  const addRow = () => onChange([...rows, novaLinha()]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-black/5 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs min-w-[160px]">Disciplina</TableHead>
              <TableHead className="text-xs text-right w-[90px]">Horas</TableHead>
              <TableHead className="text-xs text-right w-[110px]">Custo/h</TableHead>
              <TableHead className="text-xs text-right w-[110px]">Custo</TableHead>
              <TableHead className="text-xs text-right w-[130px]">Valor venda</TableHead>
              {!disabled && <TableHead className="w-[40px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={disabled ? 5 : 6} className="text-center text-xs text-muted-foreground py-6">
                  Nenhuma disciplina. Adicione linhas para detalhar horas, custo e valor por disciplina.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const preset = DISCIPLINAS_PADRAO.includes(r.disciplina);
              const selectValue = r.disciplina === "" ? "" : preset ? r.disciplina : OUTRA;
              return (
                <TableRow key={r.id}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <Select
                        value={selectValue}
                        disabled={disabled}
                        onValueChange={(v) => updateRow(r.id, { disciplina: v === OUTRA ? "" : v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {DISCIPLINAS_PADRAO.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                          <SelectItem value={OUTRA}>Outra...</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectValue === OUTRA && (
                        <Input
                          className="h-8 text-xs"
                          placeholder="Nome da disciplina"
                          value={r.disciplina}
                          disabled={disabled}
                          onChange={(e) => updateRow(r.id, { disciplina: e.target.value })}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      allowDecimal
                      min={0}
                      className="h-8 text-xs text-right"
                      value={r.horas_estimadas ? String(r.horas_estimadas).replace(".", ",") : ""}
                      disabled={disabled}
                      onChange={(v) => updateRow(r.id, { horas_estimadas: parseFloat(v.replace(",", ".")) || 0 })}
                    />
                  </TableCell>
                  <TableCell>
                    <MoneyInput
                      className="h-8 text-xs text-right"
                      value={r.custo_hora ? formatValorToInput(r.custo_hora) : ""}
                      disabled={disabled}
                      onChange={(v) => updateRow(r.id, { custo_hora: parseCurrencyString(v) })}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground align-middle">
                    {formatCurrency(custoLinha(r))}
                  </TableCell>
                  <TableCell>
                    <MoneyInput
                      className="h-8 text-xs text-right"
                      value={r.valor_venda ? formatValorToInput(r.valor_venda) : ""}
                      disabled={disabled}
                      onChange={(v) => updateRow(r.id, { valor_venda: parseCurrencyString(v) })}
                    />
                  </TableCell>
                  {!disabled && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-danger-mid"
                        onClick={() => removeRow(r.id)}
                        aria-label="Remover disciplina"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!disabled && (
        <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar disciplina
        </Button>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary" className="text-xs">
            {totais.totalHoras}h
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Custo: {formatCurrency(totais.totalCusto)}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Soma venda: {formatCurrency(totais.totalValor)}
          </Badge>
          {totais.margemPct !== null && (
            <Badge className={`text-xs ${totais.margemPct >= 0 ? "bg-positive/10 text-positive-strong" : "bg-danger-soft text-danger-strong"}`}>
              Margem: {totais.margemPct.toFixed(1)}%
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { MultiSelectFilter } from "@/components/filters/MultiSelectFilter";
import type { FluxoChecklistItemTemplate } from "@/types/fluxoDisciplinas";

interface TarefasEditorProps {
  value: FluxoChecklistItemTemplate[];
  onChange: (next: FluxoChecklistItemTemplate[]) => void;
  pessoas: { id: string; nome: string }[];
}

function parseOptionalNumber(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Lista de tarefas de um checklist (template de fluxo): uma linha por item, com
 * um checkbox decorativo (nunca marcável, é um template, não uma execução real),
 * texto editável in-place, responsáveis (multi-select — a disciplina não pede
 * mais responsável direto, é a união dos das tarefas, spec 067), dias úteis
 * opcionais (somam na duração da disciplina) e horas opcionais (só informativo,
 * nunca soma em dias) e remoção. Visualmente diferente do LabelsEditor (tags
 * horizontais): aqui a leitura é vertical, como um checklist de verdade.
 */
export function TarefasEditor({ value, onChange, pessoas }: TarefasEditorProps) {
  const [draft, setDraft] = useState("");

  const updateItem = (index: number, patch: Partial<FluxoChecklistItemTemplate>) => {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updateResponsaveis = (index: number, ids: string[]) => {
    const nomes = ids.map((id) => pessoas.find((p) => p.id === id)?.nome).filter((n): n is string => !!n);
    updateItem(index, { responsaveis_ids: ids, responsaveis_nomes: nomes });
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addDraft = () => {
    const texto = draft.trim();
    if (!texto) return;
    onChange([...value, { texto }]);
    setDraft("");
  };

  const onDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addDraft();
    }
  };

  return (
    <div className="space-y-1">
      {value.map((item, index) => (
        <div key={index} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/60">
          <span className="h-[15px] w-[15px] flex-shrink-0 rounded border-[1.5px] border-dashed border-status-unknown" />
          <Input
            value={item.texto}
            onChange={(e) => updateItem(index, { texto: e.target.value })}
            className="h-7 flex-1 min-w-[80px] border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-1"
          />
          <MultiSelectFilter
            label="Responsáveis"
            options={pessoas.map((p) => ({ value: p.id, label: p.nome }))}
            selected={item.responsaveis_ids ?? []}
            onChange={(ids) => updateResponsaveis(index, ids)}
            className="h-7 rounded-md flex-shrink-0 w-[120px] justify-start text-[11px]"
          />
          <Input
            type="number"
            min={1}
            value={item.duracao_dias_uteis ?? ""}
            onChange={(e) => updateItem(index, { duracao_dias_uteis: parseOptionalNumber(e.target.value) })}
            placeholder="dias"
            aria-label={`Dias úteis de ${item.texto}`}
            className="h-7 w-12 flex-shrink-0 border-none bg-transparent px-1 text-xs text-right shadow-none focus-visible:ring-1"
          />
          <Input
            type="number"
            min={1}
            value={item.horas_estimadas ?? ""}
            onChange={(e) => updateItem(index, { horas_estimadas: parseOptionalNumber(e.target.value) })}
            placeholder="horas"
            aria-label={`Horas estimadas de ${item.texto}`}
            className="h-7 w-14 flex-shrink-0 border-none bg-transparent px-1 text-xs text-right shadow-none focus-visible:ring-1"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="flex-shrink-0 text-muted-foreground hover:text-danger-mid"
            aria-label={`Remover tarefa ${item.texto}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 px-1 py-1">
        <span className="h-[15px] w-[15px] flex-shrink-0 rounded border-[1.5px] border-dashed border-border opacity-50" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKeyDown}
          onBlur={addDraft}
          placeholder="Adicionar tarefa…"
          className="h-7 flex-1 border-dashed bg-transparent px-1 text-xs"
        />
      </div>
    </div>
  );
}

import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { FluxoChecklistItemTemplate } from "@/types/fluxoDisciplinas";

interface TarefasEditorProps {
  value: FluxoChecklistItemTemplate[];
  onChange: (next: FluxoChecklistItemTemplate[]) => void;
}

function parseOptionalNumber(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Lista de tarefas de um checklist (template de fluxo): uma linha por item, com
 * um checkbox decorativo (nunca marcável, é um template, não uma execução real),
 * texto editável in-place, dias úteis opcionais (somam na duração da disciplina,
 * spec 067) e horas opcionais (só informativo, nunca soma em dias) e remoção.
 * Visualmente diferente do LabelsEditor (tags horizontais): aqui a leitura é
 * vertical, como um checklist de verdade.
 */
export function TarefasEditor({ value, onChange }: TarefasEditorProps) {
  const [draft, setDraft] = useState("");

  const updateItem = (index: number, patch: Partial<FluxoChecklistItemTemplate>) => {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
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
            className="h-7 flex-1 border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-1"
          />
          <Input
            type="number"
            min={1}
            value={item.duracao_dias_uteis ?? ""}
            onChange={(e) => updateItem(index, { duracao_dias_uteis: parseOptionalNumber(e.target.value) })}
            placeholder="dias"
            aria-label={`Dias úteis de ${item.texto}`}
            className="h-7 w-14 flex-shrink-0 border-none bg-transparent px-1 text-xs text-right shadow-none focus-visible:ring-1"
          />
          <Input
            type="number"
            min={1}
            value={item.horas_estimadas ?? ""}
            onChange={(e) => updateItem(index, { horas_estimadas: parseOptionalNumber(e.target.value) })}
            placeholder="horas"
            aria-label={`Horas estimadas de ${item.texto}`}
            className="h-7 w-16 flex-shrink-0 border-none bg-transparent px-1 text-xs text-right shadow-none focus-visible:ring-1"
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

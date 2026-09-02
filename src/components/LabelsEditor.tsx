import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LabelsEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
}

/** Etiquetas curtas na unidade de trabalho (spec 013). Adiciona no Enter/vírgula. */
export function LabelsEditor({ value, onChange, readOnly }: LabelsEditorProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim().replace(/,+$/, "").trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setDraft("");
  };

  const remove = (label: string) => onChange(value.filter((l) => l !== label));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((label) => (
        <Badge key={label} variant="secondary" className="h-7 gap-1.5 rounded-md px-2.5 text-xs font-normal">
          {label}
          {!readOnly && (
            <button
              type="button"
              onClick={() => remove(label)}
              className="rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={`Remover etiqueta ${label}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {!readOnly && (
        <div className="relative">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={add}
            placeholder={value.length === 0 ? "Adicionar etiqueta…" : "+ etiqueta"}
            className={cn("h-8 w-44 border-dashed text-xs", draft && "pr-7")}
          />
          {draft && (
            <button
              type="button"
              // onMouseDown (não onClick): dispara antes do onBlur do input, que
              // já adiciona a etiqueta — evita clique perdido por perda de foco.
              onMouseDown={(e) => {
                e.preventDefault();
                add();
              }}
              aria-label="Adicionar etiqueta"
              className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-ink"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {readOnly && value.length === 0 && <span className="text-xs text-muted-foreground">Sem etiquetas</span>}
    </div>
  );
}

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUp, AtSign } from "lucide-react";

interface AtividadeComposerProps {
  pessoas: { id: string; nome: string }[];
  onSubmit: (texto: string, mencionados: string[]) => void;
  placeholder?: string;
}

/**
 * Caixa de escrever atividade no padrão do chat de Agentes: textarea sem moldura
 * dentro de uma caixa arredondada, botão @ para mencionar e botão de enviar (seta,
 * verde da marca). Enter envia; Shift+Enter quebra linha. (spec 013)
 */
export function AtividadeComposer({ pessoas, onSubmit, placeholder }: AtividadeComposerProps) {
  const [texto, setTexto] = useState("");
  const [mencionados, setMencionados] = useState<string[]>([]);

  const marcar = (id: string) => {
    const p = pessoas.find((x) => x.id === id);
    if (!p) return;
    setTexto((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@${p.nome} `);
    setMencionados((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    onSubmit(t, mencionados);
    setTexto("");
    setMencionados([]);
  };

  return (
    <div className="rounded-xl border border-border bg-card transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviar();
          }
        }}
        rows={2}
        placeholder={placeholder ?? "Escrever um comentário..."}
        className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <div className="flex items-center gap-1 px-2 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Mencionar alguém"
            >
              <AtSign className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            {pessoas.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => marcar(p.id)}>
                {p.nome}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={enviar}
          disabled={!texto.trim()}
          aria-label="Enviar"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

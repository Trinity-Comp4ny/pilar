import { useState } from "react";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AddColumnInlineProps<E> {
  /** Paleta de cores da coluna (swatches). */
  colors: readonly string[];
  /** Cor pré-selecionada. Padrão: `colors[0]`. */
  initialColor?: string;
  /** Persiste a coluna. Retorna `true` no sucesso, para limpar e fechar o campo. */
  onCreate: (nome: string, cor: string, extra: E) => Promise<boolean>;
  /** Mutação em andamento (desabilita o botão). */
  busy: boolean;
  /** Valor inicial do campo extra (ex.: bucket-âncora do board de projetos). */
  extraInitial?: E;
  /** Campo extra opcional, renderizado abaixo das cores (ex.: Select "Conta como"). */
  renderExtra?: (value: E, setValue: (e: E) => void) => ReactNode;
  /** Classe do botão fechado (largura, margem, raio). */
  triggerClassName?: string;
  /** Classe do painel aberto (largura, margem, raio, padding). */
  panelClassName?: string;
  label?: string;
  placeholder?: string;
}

/**
 * "Add group" ao estilo ClickUp: campo inline com nome + cor (+ campo extra
 * opcional), sem modal. Compartilhado pelos boards de Projetos e Meu Trabalho
 * (ADR 0020 / SPEC 041) — o Select de balde-âncora entra via `renderExtra`.
 */
export function AddColumnInline<E = undefined>({
  colors,
  initialColor,
  onCreate,
  busy,
  extraInitial,
  renderExtra,
  triggerClassName,
  panelClassName,
  label = "Nova coluna",
  placeholder = "Nome da coluna",
}: AddColumnInlineProps<E>) {
  const firstColor = initialColor ?? colors[0];
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<string>(firstColor);
  const [extra, setExtra] = useState<E>(extraInitial as E);

  const fechar = () => {
    setAberto(false);
    setNome("");
    setCor(firstColor);
    setExtra(extraInitial as E);
  };

  const criar = async () => {
    if (!nome.trim() || busy) return;
    const ok = await onCreate(nome, cor, extra);
    if (ok) fechar();
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={cn(
          "flex h-11 shrink-0 items-center justify-center gap-1.5 border border-dashed text-sm text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground",
          triggerClassName
        )}
      >
        <Plus className="h-4 w-4" /> {label}
      </button>
    );
  }

  return (
    <div className={cn("shrink-0 space-y-2 border bg-card shadow-sm", panelClassName)}>
      <Input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            criar();
          } else if (e.key === "Escape") {
            fechar();
          }
        }}
        placeholder={placeholder}
        className="h-8"
      />
      <div className="flex flex-wrap gap-1.5 px-0.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCor(c)}
            aria-label={`Cor ${c}`}
            className={cn(
              "h-5 w-5 rounded-full ring-offset-2 ring-offset-card transition-shadow",
              cor === c && "ring-2 ring-foreground/60"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      {renderExtra?.(extra, setExtra)}
      <div className="flex items-center gap-2">
        <Button variant="brand" size="sm" className="h-7" onClick={criar} disabled={!nome.trim() || busy}>
          Adicionar
        </Button>
        <Button variant="ghost" size="sm" className="h-7" onClick={fechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

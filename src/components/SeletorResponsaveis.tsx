import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AvatarStack } from "@/components/AvatarStack";
import { cn } from "@/lib/utils";

export interface PessoaSelecionavel {
  id: string;
  nome: string;
  avatarUrl?: string | null;
}

interface SeletorResponsaveisProps {
  value: string[];
  pessoas: PessoaSelecionavel[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** Gatilho compacto (só círculos), pra uso dentro de linha de lista/tabela. */
  compact?: boolean;
  emptyLabel?: string;
  className?: string;
  opcaoExtra?: { label: string; selecionada: boolean; onSelect: () => void };
  pessoasDesabilitadas?: boolean;
}

/**
 * Seleção de vários responsáveis: pilha de avatares circulares no gatilho
 * (padrão do design system, ver AvatarStack), toggle na lista ao abrir.
 * Compartilhado entre meu-trabalho (TarefaDialog) e fluxos de disciplinas
 * (TarefasEditor, FluxoDisciplinasDialog) — regra dos 3 usos.
 */
export function SeletorResponsaveis({
  value,
  pessoas,
  onChange,
  disabled,
  compact = false,
  emptyLabel = "Sem responsável",
  className,
  opcaoExtra,
  pessoasDesabilitadas = false,
}: SeletorResponsaveisProps) {
  const [open, setOpen] = useState(false);
  const selecionadas = pessoas.filter((p) => value.includes(p.id));
  const extraAtiva = opcaoExtra?.selecionada;
  const rotulo = extraAtiva
    ? opcaoExtra.label
    : selecionadas.length
      ? selecionadas.map((p) => p.nome).join(", ")
      : emptyLabel;

  const toggle = (id: string) => {
    onChange(extraAtiva ? [id] : value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={rotulo}
        title={rotulo}
        className={cn(
          "flex shrink-0 items-center rounded-full",
          compact ? "h-7 gap-1" : "h-9 w-full gap-2 rounded-md border bg-background px-3 text-sm",
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted/40",
          className
        )}
      >
        {extraAtiva ? (
          <span className="truncate text-sm">{opcaoExtra.label}</span>
        ) : selecionadas.length > 0 ? (
          <>
            <AvatarStack pessoas={selecionadas} size="xs" />
            {!compact && (
              <span className="min-w-0 flex-1 truncate text-left">
                {selecionadas.length === 1 ? selecionadas[0].nome : `${selecionadas.length} responsáveis`}
              </span>
            )}
          </>
        ) : compact ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="flex flex-1 items-center gap-1.5 text-left text-muted-foreground">
            <UserPlus className="h-4 w-4" /> {emptyLabel}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Buscar pessoa..." className="h-9" />
          <CommandList>
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup>
              {opcaoExtra && (
                <CommandItem
                  value={opcaoExtra.label}
                  onSelect={() => {
                    opcaoExtra.onSelect();
                    setOpen(false);
                  }}
                >
                  <span className="flex-1">{opcaoExtra.label}</span>
                  {extraAtiva && <Check className="h-4 w-4 text-brand" />}
                </CommandItem>
              )}
              {pessoas.map((p) => {
                const marcado = !extraAtiva && value.includes(p.id);
                return (
                  <CommandItem
                    key={p.id}
                    value={p.nome}
                    disabled={pessoasDesabilitadas}
                    onSelect={() => toggle(p.id)}
                    className={cn("gap-2", marcado && "font-medium")}
                  >
                    <AvatarStack pessoas={[p]} size="xs" />
                    <span className="flex-1 truncate">{p.nome}</span>
                    {marcado && <Check className="h-4 w-4 text-brand" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

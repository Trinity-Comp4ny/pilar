// Filtros da toolbar de "Meu trabalho", no mesmo padrão visual dos filtros do
// resto da plataforma (pill arredondada + popover, como o FiltroPeriodo do
// Financeiro). O filtro de pessoa usa avatar de iniciais, estilo ClickUp.
import { useState } from "react";
import { Check, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AvatarStack } from "@/components/AvatarStack";
import { cn } from "@/lib/utils";
import type { PessoaOpcao } from "../hooks";

type Opcao = { value: string; label: string };

/** Pill de seleção única no padrão dos filtros da plataforma. */
export function FiltroPill({
  icon: Icon,
  value,
  options,
  onChange,
  align = "start",
}: {
  icon: LucideIcon;
  value: string;
  options: Opcao[];
  onChange: (value: string) => void;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const atual = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-1.5 rounded-full px-3.5 text-[13px] font-normal">
          <Icon size={14} className="text-black/50" />
          {atual?.label ?? "Filtrar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <div className="flex min-w-[188px] flex-col gap-0.5 p-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
                value === o.value ? "bg-brand/15 font-medium text-ink" : "text-black/70 hover:bg-black/4"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Filtro de pessoa com avatar de iniciais (estilo ClickUp). Múltipla escolha.
 * A pessoa do usuário logado aparece uma vez só, no topo da lista, com "(você)";
 * não existe opção "Eu" separada (virava duplicata do próprio nome). */
export function FiltroPessoa({
  value,
  pessoas,
  minhaPessoaId,
  onChange,
}: {
  value: string[];
  pessoas: PessoaOpcao[];
  minhaPessoaId: string | null;
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  // "eu" é o valor antigo guardado em links e filtros salvos; vale como a própria pessoa.
  const marcados = new Set(value.map((v) => (v === "eu" ? minhaPessoaId : v)));
  const ordenadas = [
    ...pessoas.filter((p) => p.id === minhaPessoaId),
    ...pessoas.filter((p) => p.id !== minhaPessoaId),
  ];
  const selecionadas = ordenadas.filter((p) => marcados.has(p.id));

  const toggle = (id: string) => {
    const proximos = new Set(marcados);
    if (proximos.has(id)) proximos.delete(id);
    else proximos.add(id);
    onChange([...proximos].filter((v): v is string => !!v));
  };

  const rotulo =
    selecionadas.length === 0
      ? "Todos"
      : selecionadas.length === 1
        ? selecionadas[0].nome
        : `${selecionadas.length} pessoas`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-1.5 rounded-full py-0 text-[13px] font-normal",
            selecionadas.length > 0 ? "pl-1 pr-3.5" : "px-3.5"
          )}
          aria-label="Filtrar por pessoa"
        >
          {selecionadas.length > 0 ? (
            <AvatarStack pessoas={selecionadas} size="xs" />
          ) : (
            <Users size={14} className="text-black/50" />
          )}
          {rotulo}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Buscar pessoa..." className="h-9" />
          <CommandList>
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup>
              {ordenadas.map((p) => {
                const marcada = marcados.has(p.id);
                return (
                  <CommandItem
                    key={p.id}
                    value={p.nome}
                    onSelect={() => toggle(p.id)}
                    className={cn("gap-2", marcada && "font-medium")}
                  >
                    <AvatarStack pessoas={[p]} size="xs" />
                    <span className="flex-1 truncate">{p.nome}</span>
                    {p.id === minhaPessoaId && <span className="text-xs text-muted-foreground">(você)</span>}
                    {marcada && <Check className="h-4 w-4 text-brand" />}
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

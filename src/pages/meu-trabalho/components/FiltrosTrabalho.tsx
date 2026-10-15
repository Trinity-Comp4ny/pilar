// Filtro de pessoa da toolbar de Tarefas. Usa o gatilho padrão dos filtros
// (`filterTriggerClass`, SPEC 124) e avatar de iniciais, estilo ClickUp.
import { useState } from "react";
import { Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AvatarStack } from "@/components/AvatarStack";
import { cn } from "@/lib/utils";
import { filterTriggerClass } from "@/components/filters/filterStyles";
import type { PessoaOpcao } from "../hooks";

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
      ? "Pessoa"
      : selecionadas.length === 1
        ? selecionadas[0].nome
        : `${selecionadas.length} pessoas`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={filterTriggerClass(
            selecionadas.length > 0,
            selecionadas.length > 0 ? "py-0 pl-1 pr-3.5" : undefined
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

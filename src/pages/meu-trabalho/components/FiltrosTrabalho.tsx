// Filtros da toolbar de "Meu trabalho", no mesmo padrão visual dos filtros do
// resto da plataforma (pill arredondada + popover, como o FiltroPeriodo do
// Financeiro). O filtro de pessoa usa avatar de iniciais, estilo ClickUp.
import { useState } from "react";
import { Check, type LucideIcon } from "lucide-react";
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
                value === o.value ? "bg-brand/15 font-medium text-ink" : "text-black/70 hover:bg-black/[0.04]"
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

/** Filtro de pessoa com avatar de iniciais (estilo ClickUp). Múltipla escolha;
 * "eu" é uma opção como outra qualquer, marcando a pessoa do usuário logado. */
export function FiltroPessoa({
  value,
  pessoas,
  minhaPessoaId,
  meuNome,
  meuAvatarUrl,
  onChange,
}: {
  value: string[];
  pessoas: PessoaOpcao[];
  minhaPessoaId: string | null;
  meuNome: string;
  /** Foto do usuário logado, direto do profile (não depende de existir uma
   * `pessoa` vinculada — ultra_admin e outros perfis sem pessoa não têm uma). */
  meuAvatarUrl?: string | null;
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const eu = { nome: meuNome, avatarUrl: meuAvatarUrl };
  const ehEuSelecionado = value.includes("eu");
  const selecionadas = [
    ...(ehEuSelecionado ? [eu] : []),
    ...pessoas.filter((p) => p.id !== minhaPessoaId && value.includes(p.id)),
  ];

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const rotulo =
    selecionadas.length === 0
      ? "Filtrar"
      : selecionadas.length === 1
        ? ehEuSelecionado
          ? "Eu"
          : selecionadas[0].nome
        : `${selecionadas.length} pessoas`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-1.5 rounded-full py-0 pl-1 pr-3.5 text-[13px] font-normal"
          aria-label="Filtrar por pessoa"
        >
          <AvatarStack pessoas={selecionadas.length > 0 ? selecionadas : [rotulo]} size="xs" />
          {rotulo}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Buscar pessoa..." className="h-9" />
          <CommandList>
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="eu"
                onSelect={() => toggle("eu")}
                className={cn("gap-2", ehEuSelecionado && "font-medium")}
              >
                <AvatarStack pessoas={[eu]} size="xs" />
                <span className="flex-1 truncate">Eu</span>
                {ehEuSelecionado && <Check className="h-4 w-4 text-brand" />}
              </CommandItem>
              {pessoas
                .filter((p) => p.id !== minhaPessoaId)
                .map((p) => {
                  const marcada = value.includes(p.id);
                  return (
                    <CommandItem
                      key={p.id}
                      value={p.nome}
                      onSelect={() => toggle(p.id)}
                      className={cn("gap-2", marcada && "font-medium")}
                    >
                      <AvatarStack pessoas={[p]} size="xs" />
                      <span className="flex-1 truncate">{p.nome}</span>
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

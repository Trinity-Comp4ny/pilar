// Filtros da toolbar de "Meu trabalho", no mesmo padrão visual dos filtros do
// resto da plataforma (pill arredondada + popover, como o FiltroPeriodo do
// Financeiro). O filtro de pessoa usa avatar de iniciais, estilo ClickUp.
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
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

/** Filtro de pessoa com avatar de iniciais (estilo ClickUp). "eu" = a mim. */
export function FiltroPessoa({
  value,
  pessoas,
  minhaPessoaId,
  meuNome,
  meuAvatarUrl,
  onChange,
}: {
  value: string;
  pessoas: PessoaOpcao[];
  minhaPessoaId: string | null;
  meuNome: string;
  /** Foto do usuário logado, direto do profile (não depende de existir uma
   * `pessoa` vinculada — ultra_admin e outros perfis sem pessoa não têm uma). */
  meuAvatarUrl?: string | null;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ehEu = value === "eu";
  const eu = { nome: meuNome, avatarUrl: meuAvatarUrl };
  const selecionada = ehEu ? eu : (pessoas.find((p) => p.id === value) ?? null);
  const nome = ehEu ? meuNome : (selecionada?.nome ?? "Pessoa");
  const rotulo = ehEu ? "Eu" : nome;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-1.5 rounded-full py-0 pl-1 pr-3.5 text-[13px] font-normal"
          aria-label="Filtrar por pessoa"
        >
          <AvatarStack pessoas={[selecionada ?? nome]} size="xs" />
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
                onSelect={() => {
                  onChange("eu");
                  setOpen(false);
                }}
                className={cn("gap-2", ehEu && "font-medium")}
              >
                <AvatarStack pessoas={[eu]} size="xs" /> Eu
              </CommandItem>
              {pessoas
                .filter((p) => p.id !== minhaPessoaId)
                .map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.nome}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={cn("gap-2", p.id === value && "font-medium")}
                  >
                    <AvatarStack pessoas={[p]} size="xs" /> {p.nome}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

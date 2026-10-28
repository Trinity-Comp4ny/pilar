import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { corDaEtapaProjeto, type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";

interface EtapaSelectProps {
  projetoNome: string;
  /** Etapa atual; sem etapa (legado) cai no `statusFallback`. */
  etapaId: string | null | undefined;
  statusFallback: string;
  etapas: ProjetoEtapa[];
  /** Sem permissão de editar, mostra só a etapa em texto. */
  canEdit: boolean;
  onSelect: (etapaId: string) => void;
}

function EtapaMarca({ cor, nome }: { cor: string; nome: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
      <span className="text-sm">{nome}</span>
    </span>
  );
}

/** Rótulo do bucket só quando difere do nome da etapa ("Revisão" em "Em andamento"). */
const rotuloDoBucket = (etapa: ProjetoEtapa) => {
  const rotulo = PROJECT_STATUS_CONFIG[etapa.bucket]?.label;
  return rotulo && rotulo !== etapa.nome ? rotulo : null;
};

/**
 * Etapa do projeto numa linha da Lista: clica e escolhe outra sem abrir o projeto (SPEC 142).
 * Desktop abre um menu com busca; abaixo de md abre uma sheet inferior. A regra de mover
 * (pausar, retomar, reabrir) fica em `moverParaEtapa`, igual ao arraste do quadro.
 */
export function EtapaSelect({ projetoNome, etapaId, statusFallback, etapas, canEdit, onSelect }: EtapaSelectProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const atual = etapas.find((e) => e.id === etapaId);
  const marca = <EtapaMarca cor={corDaEtapaProjeto(atual?.cor ?? null)} nome={atual?.nome ?? statusFallback} />;

  if (!canEdit) return marca;

  const escolher = (id: string) => {
    setOpen(false);
    if (id !== etapaId) onSelect(id);
  };

  const gatilho = (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-label={`Mudar etapa de ${projetoNome}`}
      onClick={(e) => {
        // A linha inteira abre o projeto: o clique na etapa não pode vazar para ela.
        e.stopPropagation();
        if (isMobile) setOpen(true);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-transparent py-0.5 pl-2 pr-1.5 transition-colors",
        "hover:border-border hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        open && "border-border bg-muted"
      )}
    >
      {marca}
      <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
    </button>
  );

  const opcoes = etapas.map((e) => {
    const rotulo = rotuloDoBucket(e);
    return (
      <CommandItem key={e.id} value={`${e.nome} ${rotulo ?? ""}`} onSelect={() => escolher(e.id)} className="gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: corDaEtapaProjeto(e.cor) }} />
        <span className="text-sm">{e.nome}</span>
        {rotulo && <span className="text-[11px] text-muted-foreground">{rotulo}</span>}
        {e.id === etapaId && <Check className="ml-auto h-3.5 w-3.5" aria-hidden />}
      </CommandItem>
    );
  });

  if (isMobile) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        {gatilho}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-left text-base">Mudar etapa de {projetoNome}</SheetTitle>
            </SheetHeader>
            <Command className="mt-2">
              <CommandList className="max-h-none">{opcoes}</CommandList>
            </Command>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Buscar etapa..." className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">Nenhuma etapa.</CommandEmpty>
            {opcoes}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

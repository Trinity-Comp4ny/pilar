// Células editáveis inline da lista de "Meu trabalho" (estilo ClickUp): o valor
// vira controle direto na linha. Tarefa é editável; disciplina fica só leitura
// (o status/responsável dela mora no projeto, não se muda daqui).
import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Check, Clock, Flag, FolderOpen, Plus, Tag, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LabelsEditor } from "@/components/LabelsEditor";
import { AvatarStack } from "@/components/AvatarStack";
import { cn } from "@/lib/utils";
import { formatHoras } from "@/lib/format";
import type { PessoaOpcao } from "../hooks";
import { PRIORIDADE_DOT_CLASS, PRIORIDADE_LABEL, PRIORIDADE_ORDER, type Prioridade } from "../status";

// Impede que o clique na célula editável dispare o "abrir tarefa" da linha.
function pararClique(e: React.MouseEvent) {
  e.stopPropagation();
}

// --- Responsável ---------------------------------------------------------

type ResponsavelCellProps = {
  responsaveis: PessoaOpcao[];
  pessoas: PessoaOpcao[];
  editavel: boolean;
  onChange: (pessoaIds: string[]) => void;
};

export function ResponsavelCell({ responsaveis, pessoas, editavel, onChange }: ResponsavelCellProps) {
  const [open, setOpen] = useState(false);
  const ids = new Set(responsaveis.map((r) => r.id));

  const toggle = (pessoaId: string) => {
    const next = new Set(ids);
    if (next.has(pessoaId)) next.delete(pessoaId);
    else next.add(pessoaId);
    onChange([...next]);
  };

  const conteudo =
    responsaveis.length > 0 ? (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <AvatarStack pessoas={responsaveis} size="xs" />
        <span className="truncate text-xs text-foreground">
          {responsaveis.length === 1 ? responsaveis[0].nome : `${responsaveis.length} responsáveis`}
        </span>
      </span>
    ) : editavel ? (
      <span className="inline-flex items-center gap-1 text-muted-foreground/60 group-hover:text-muted-foreground">
        <UserPlus className="h-3.5 w-3.5" />
        <span className="text-xs">Atribuir</span>
      </span>
    ) : (
      <span className="text-xs text-muted-foreground/40">—</span>
    );

  if (!editavel) return <div className="min-w-0 truncate">{conteudo}</div>;

  return (
    <div onClick={pararClique}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex min-w-0 items-center rounded px-1 py-0.5 hover:bg-muted">
          {conteudo}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <Command>
            <CommandInput placeholder="Buscar pessoa..." className="h-9" />
            <CommandList>
              <CommandEmpty>Ninguém encontrado.</CommandEmpty>
              <CommandGroup>
                {pessoas.map((p) => {
                  const marcado = ids.has(p.id);
                  return (
                    <CommandItem
                      key={p.id}
                      value={p.nome}
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
    </div>
  );
}

// --- Prazo ---------------------------------------------------------------

function parseIso(iso: string | null): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

type PrazoCellProps = {
  prazo: string | null;
  /** true quando a data já passou e o item não está concluído. */
  atrasado: boolean;
  editavel: boolean;
  onChange: (iso: string | null) => void;
};

/** Rótulo claro do prazo: "Hoje", "Amanhã", "12 fev" ou "12 fev 2027" (outro ano). */
function rotuloPrazo(data: Date): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(data);
  alvo.setHours(0, 0, 0, 0);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias === -1) return "Ontem";
  const mesmoAno = alvo.getFullYear() === hoje.getFullYear();
  return format(data, mesmoAno ? "dd MMM" : "dd MMM yyyy", { locale: ptBR });
}

export function PrazoCell({ prazo, atrasado, editavel, onChange }: PrazoCellProps) {
  const [open, setOpen] = useState(false);
  const data = parseIso(prazo);
  const texto = data ? rotuloPrazo(data) : null;

  const conteudo = texto ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        atrasado && "font-medium text-destructive"
      )}
    >
      <CalendarPlus className={cn("h-3 w-3 shrink-0", atrasado ? "text-destructive" : "text-muted-foreground/50")} />
      {texto}
    </span>
  ) : editavel ? (
    <span className="inline-flex items-center gap-1 text-muted-foreground/60 group-hover:text-muted-foreground">
      <CalendarPlus className="h-3.5 w-3.5" />
      <span className="text-xs">Prazo</span>
    </span>
  ) : (
    <span className="text-xs text-muted-foreground/40">—</span>
  );

  if (!editavel) return <div className="truncate">{conteudo}</div>;

  return (
    <div onClick={pararClique}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex items-center rounded px-1 py-0.5 hover:bg-muted">{conteudo}</PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={data}
            onSelect={(d) => {
              onChange(d ? format(d, "yyyy-MM-dd") : null);
              setOpen(false);
            }}
            defaultMonth={data}
            locale={ptBR}
            autoFocus
          />
          {prazo && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full border-t px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              Limpar prazo
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// --- Prioridade ----------------------------------------------------------

type PrioridadeCellProps = {
  prioridade: Prioridade;
  editavel: boolean;
  onChange: (prioridade: Prioridade) => void;
};

export function PrioridadeCell({ prioridade, editavel, onChange }: PrioridadeCellProps) {
  const conteudo = (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Flag
        className={cn(
          "h-3 w-3",
          prioridade === "alta"
            ? "text-destructive"
            : prioridade === "media"
              ? "text-warning"
              : "text-muted-foreground/40"
        )}
      />
      {PRIORIDADE_LABEL[prioridade]}
    </span>
  );

  if (!editavel) return <div className="truncate">{conteudo}</div>;

  return (
    <div onClick={pararClique}>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center rounded px-1 py-0.5 hover:bg-muted" title="Mudar prioridade">
          {conteudo}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PRIORIDADE_ORDER.map((p) => (
            <DropdownMenuItem key={p} onClick={() => onChange(p)}>
              <span className={cn("mr-2 h-2 w-2 rounded-full", PRIORIDADE_DOT_CLASS[p])} />
              {PRIORIDADE_LABEL[p]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// --- Projeto -------------------------------------------------------------

type ProjetoCellProps = {
  projetoId: string | null;
  projetoNome: string | null;
  projetos: PessoaOpcao[];
  editavel: boolean;
  onChange: (projetoId: string | null) => void;
};

export function ProjetoCell({ projetoId, projetoNome, projetos, editavel, onChange }: ProjetoCellProps) {
  const [open, setOpen] = useState(false);

  const conteudo = projetoNome ? (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      <FolderOpen className="h-3 w-3 shrink-0" />
      <span className="truncate">{projetoNome}</span>
    </span>
  ) : editavel ? (
    <span className="inline-flex items-center gap-1 text-muted-foreground/60 group-hover:text-muted-foreground">
      <Plus className="h-3.5 w-3.5" />
      <span className="text-xs">Projeto</span>
    </span>
  ) : (
    <span className="text-xs text-muted-foreground/40">—</span>
  );

  if (!editavel) return <div className="min-w-0 truncate">{conteudo}</div>;

  return (
    <div onClick={pararClique}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex min-w-0 items-center rounded px-1 py-0.5 hover:bg-muted">
          {conteudo}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <Command>
            <CommandInput placeholder="Buscar projeto..." className="h-9" />
            <CommandList>
              <CommandEmpty>Nenhum projeto.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="sem-projeto"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className={cn(!projetoId && "font-medium")}
                >
                  <span className="text-muted-foreground">Sem projeto</span>
                </CommandItem>
                {projetos.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.nome}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={cn("gap-2", p.id === projetoId && "font-medium")}
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    {p.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// --- Etiquetas -----------------------------------------------------------

type EtiquetasCellProps = {
  labels: string[];
  editavel: boolean;
  onChange: (next: string[]) => void;
};

export function EtiquetasCell({ labels, editavel, onChange }: EtiquetasCellProps) {
  const conteudo =
    labels.length > 0 ? (
      <span className="flex min-w-0 items-center gap-1 overflow-hidden">
        {labels.slice(0, 2).map((l) => (
          <Badge key={l} variant="secondary" className="shrink-0 text-[10px] font-normal">
            {l}
          </Badge>
        ))}
        {labels.length > 2 && <span className="shrink-0 text-[10px] text-muted-foreground">+{labels.length - 2}</span>}
      </span>
    ) : editavel ? (
      <span className="inline-flex items-center gap-1 text-muted-foreground/60 group-hover:text-muted-foreground">
        <Tag className="h-3.5 w-3.5" />
        <span className="text-xs">Etiqueta</span>
      </span>
    ) : (
      <span className="text-xs text-muted-foreground/40">—</span>
    );

  if (!editavel) return <div className="min-w-0 truncate">{conteudo}</div>;

  return (
    <div onClick={pararClique}>
      <Popover>
        <PopoverTrigger className="flex min-w-0 items-center rounded px-1 py-0.5 hover:bg-muted">
          {conteudo}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <LabelsEditor value={labels} onChange={onChange} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// --- Horas (estimadas / reais) -------------------------------------------

function paraDecimalDigitado(raw: string): number | null {
  const normalizado = raw.trim().replace(",", ".");
  if (!normalizado) return null;
  const dec = Number(normalizado);
  return Number.isFinite(dec) && dec >= 0 ? dec : null;
}

type HorasCellProps = {
  valor: number | null;
  editavel: boolean;
  onChange: (dec: number | null) => void;
};

/** Campo único em decimal, estilo ClickUp: "1" = 1h, "0.5" = 30min. */
export function HorasCell({ valor, editavel, onChange }: HorasCellProps) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState(valor == null ? "" : String(valor));
  const textoAtual = valor == null ? "" : String(valor);
  const conteudoTexto = formatHoras(valor);
  const previewDigitando = formatHoras(paraDecimalDigitado(texto));

  // Sincroniza o campo quando o popover abre (valor pode ter mudado fora daqui).
  const abrir = (aberto: boolean) => {
    if (aberto) {
      setTexto(textoAtual);
    } else {
      salvar(texto);
    }
    setOpen(aberto);
  };

  const salvar = (raw: string) => {
    const normalizado = raw.trim().replace(",", ".");
    const dec = normalizado ? Number(normalizado) : null;
    if (normalizado && (!Number.isFinite(dec) || (dec as number) < 0)) return;
    const arredondado = dec == null ? null : Math.round(dec * 1000) / 1000;
    if (arredondado !== valor) onChange(arredondado);
  };

  const conteudo = conteudoTexto ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{conteudoTexto}</span>
  ) : editavel ? (
    <span className="inline-flex items-center gap-1 text-muted-foreground/60 group-hover:text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
    </span>
  ) : (
    <span className="text-xs text-muted-foreground/40">—</span>
  );

  if (!editavel) return <div className="truncate">{conteudo}</div>;

  return (
    <div onClick={pararClique}>
      <Popover open={open} onOpenChange={abrir}>
        <PopoverTrigger className="flex items-center rounded px-1 py-0.5 hover:bg-muted">{conteudo}</PopoverTrigger>
        <PopoverContent align="start" className="w-40 p-3">
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Horas</span>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="0"
                step="0.25"
                inputMode="decimal"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onBlur={(e) => salvar(e.target.value)}
                className="h-9"
                placeholder="0"
                autoFocus
              />
              {previewDigitando && <span className="text-xs text-muted-foreground">{previewDigitando}</span>}
            </div>
          </label>
          {texto && (
            <button
              type="button"
              onClick={() => {
                setTexto("");
                if (valor !== null) onChange(null);
              }}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

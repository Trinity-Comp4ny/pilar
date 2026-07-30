import { CalendarDays, FolderOpen, Link2, MessageSquare, MoreVertical, Pencil, Trash2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PRIORIDADE_DOT_CLASS, PRIORIDADE_LABEL, PRIORIDADE_ORDER, type Prioridade } from "../status";
import type { ItemTrabalho } from "../useItensTrabalho";

function prazoInfo(prazo: string | null, concluida: boolean): { texto: string; atrasado: boolean } | null {
  if (!prazo) return null;
  const d = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return { texto: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), atrasado: !concluida && d < hoje };
}

type Props = {
  item: ItemTrabalho;
  onAbrir: (item: ItemTrabalho) => void;
  onPrioridade: (item: ItemTrabalho, prioridade: Prioridade) => void;
  onExcluir: (item: ItemTrabalho) => void;
};

export function CardTrabalho({ item, onAbrir, onPrioridade, onExcluir }: Props) {
  const prazo = prazoInfo(item.prazo, item.status === "concluida");
  const ehTarefa = item.tipo === "tarefa";

  return (
    <div className="group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      {/* Prioridade (editável na tarefa) + tipo */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!ehTarefa}
            className={cn(
              "flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-muted-foreground",
              ehTarefa && "hover:bg-muted"
            )}
            title={ehTarefa ? "Mudar prioridade" : "Prioridade da disciplina"}
          >
            <span className={cn("h-2 w-2 rounded-full", PRIORIDADE_DOT_CLASS[item.prioridade])} />
            {PRIORIDADE_LABEL[item.prioridade]}
          </DropdownMenuTrigger>
          {ehTarefa && (
            <DropdownMenuContent align="start">
              {PRIORIDADE_ORDER.map((p) => (
                <DropdownMenuItem key={p} onClick={() => onPrioridade(item, p)}>
                  <span className={cn("mr-2 h-2 w-2 rounded-full", PRIORIDADE_DOT_CLASS[p])} />
                  {PRIORIDADE_LABEL[p]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            {ehTarefa ? "Tarefa" : "Disciplina"}
          </Badge>
          {ehTarefa && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                  aria-label="Ações da tarefa"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onAbrir(item)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onExcluir(item)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Título: abre detalhe */}
      <button
        type="button"
        onClick={() => onAbrir(item)}
        className="mb-2 block w-full text-left text-sm font-medium leading-snug text-foreground hover:opacity-70"
      >
        {item.titulo}
      </button>

      {/* Metadados */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {item.responsavelNome && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {item.responsavelNome}
          </span>
        )}
        {prazo && (
          <span className={cn("inline-flex items-center gap-1", prazo.atrasado && "text-destructive font-medium")}>
            <CalendarDays className="h-3 w-3" />
            {prazo.texto}
          </span>
        )}
        {item.projetoNome && (
          <span className="inline-flex items-center gap-1 truncate">
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.projetoNome}</span>
          </span>
        )}
      </div>

      {/* Etiquetas + contadores */}
      {(item.labels.length > 0 || item.comentarios > 0 || item.links > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {item.labels.map((l) => (
            <Badge key={l} variant="secondary" className="text-[10px] font-normal">
              {l}
            </Badge>
          ))}
          <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            {item.comentarios > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {item.comentarios}
              </span>
            )}
            {item.links > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Link2 className="h-3 w-3" />
                {item.links}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

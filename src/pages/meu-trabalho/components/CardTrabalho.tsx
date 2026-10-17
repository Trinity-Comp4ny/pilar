import { CalendarDays, FolderOpen, HardHat, Link2, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { AvatarStack } from "@/components/AvatarStack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KanbanCard, KanbanChip, KanbanPriority } from "@/components/kanban/KanbanCard";
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
  isDragging?: boolean;
};

export function CardTrabalho({ item, onAbrir, onPrioridade, onExcluir, isDragging }: Props) {
  const prazo = prazoInfo(item.prazo, item.status === "concluida");
  const ehTarefa = item.tipo === "tarefa";
  const temMeta = item.responsaveis.length > 0 || !!prazo || !!item.projetoNome || !!item.obraCaminho;
  const prioridade = (
    <KanbanPriority label={PRIORIDADE_LABEL[item.prioridade]} dotClass={PRIORIDADE_DOT_CLASS[item.prioridade]} />
  );

  return (
    <KanbanCard
      isDragging={isDragging}
      onClick={() => onAbrir(item)}
      eyebrow={
        ehTarefa ? (
          // Prioridade editável direto no card; só a tarefa muda, a disciplina herda do projeto.
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="-ml-1 rounded px-1 py-0.5 hover:bg-muted"
              title="Mudar prioridade"
            >
              {prioridade}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
              {PRIORIDADE_ORDER.map((p) => (
                <DropdownMenuItem key={p} onClick={() => onPrioridade(item, p)}>
                  <span className={cn("mr-2 h-2 w-2 rounded-full", PRIORIDADE_DOT_CLASS[p])} />
                  {PRIORIDADE_LABEL[p]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          prioridade
        )
      }
      tag={ehTarefa ? "Tarefa" : "Disciplina"}
      menu={
        ehTarefa ? (
          <>
            <DropdownMenuItem onClick={() => onAbrir(item)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onExcluir(item)}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </>
        ) : undefined
      }
      title={item.titulo}
      meta={
        temMeta ? (
          <>
            {item.responsaveis.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <AvatarStack pessoas={item.responsaveis} size="xs" />
                {item.responsaveis.length === 1 && <span>{item.responsaveis[0].nome}</span>}
              </span>
            )}
            {prazo && (
              <span className={cn("inline-flex items-center gap-1", prazo.atrasado && "font-medium text-destructive")}>
                <CalendarDays className="h-3 w-3" />
                {prazo.texto}
              </span>
            )}
            {item.projetoNome && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <FolderOpen className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.projetoNome}</span>
              </span>
            )}
            {item.obraCaminho && (
              <span className="inline-flex min-w-0 items-center gap-1" title={item.obraCaminho}>
                <HardHat className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.obraCaminho}</span>
              </span>
            )}
          </>
        ) : undefined
      }
      footer={
        item.labels.length > 0 || item.comentarios > 0 || item.links > 0 ? (
          <>
            <span className="flex min-w-0 flex-wrap gap-1">
              {item.labels.map((l) => (
                <KanbanChip key={l}>{l}</KanbanChip>
              ))}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-2">
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
          </>
        ) : undefined
      }
    />
  );
}

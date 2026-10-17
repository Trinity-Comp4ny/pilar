import type { HTMLAttributes, ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  /** Canto esquerdo da primeira linha: prioridade, alerta, status. */
  eyebrow?: ReactNode;
  /** Etiqueta de tipo ("Tarefa"), colada à direita, antes do menu. */
  tag?: string;
  /** Itens do menu de ações (`DropdownMenuItem`). Sem itens, sem menu. */
  menu?: ReactNode;
  title: ReactNode;
  /** Linha de apoio sob o título (cliente, empresa). */
  subtitle?: ReactNode;
  /** Linha de metadados: responsável, prazo, projeto. */
  meta?: ReactNode;
  /** Rodapé: etiquetas, contadores, valor. */
  footer?: ReactNode;
  onClick?: () => void;
  isDragging?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "title" | "onClick">;

/**
 * Card único dos quadros Kanban (Tarefas, Projetos, Leads, SPEC 122). Fixa
 * raio, padding, ritmo vertical e a posição de cada peça; a tela só preenche
 * os espaços. Não ponha número "#N" aqui: o identificador vive no detalhe.
 */
export function KanbanCard({
  eyebrow,
  tag,
  menu,
  title,
  subtitle,
  meta,
  footer,
  onClick,
  isDragging,
  className,
  ...rest
}: Props) {
  const temCabecalho = !!eyebrow || !!tag;
  // Sem eyebrow nem tag, o menu divide a linha com o título em vez de abrir uma linha vazia.
  const menuNoTitulo = !temCabecalho && !!menu;
  return (
    <div
      {...rest}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border border-border bg-surface-card p-3 text-left shadow-sm transition-shadow hover:shadow-md",
        onClick && "cursor-pointer",
        isDragging && "rotate-1 shadow-md",
        className
      )}
    >
      {temCabecalho && (
        <div className="flex min-h-5 items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {eyebrow}
          </div>
          {tag && (
            <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
              {tag}
            </span>
          )}
          {menu && <KanbanCardMenu>{menu}</KanbanCardMenu>}
        </div>
      )}

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {onClick ? (
            // O título é o ponto de foco por teclado; o clique no resto do card chega ao mesmo destino.
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="line-clamp-2 w-full text-left text-sm font-medium leading-snug text-foreground"
            >
              {title}
            </button>
          ) : (
            <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{title}</p>
          )}
          {subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {menuNoTitulo && <KanbanCardMenu>{menu}</KanbanCardMenu>}
      </div>

      {meta && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{meta}</div>}
      {footer && <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** Menu "mais opções" do card. O clique não propaga: não abre o detalhe. */
function KanbanCardMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="-my-1.5 -mr-1.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Mais opções"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Chip de etiqueta do rodapé (labels do usuário). Mesmo visual em toda tela. */
export function KanbanChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-none text-foreground/80", className)}>
      {children}
    </span>
  );
}

/** Prioridade na primeira linha: ponto colorido + rótulo, igual em toda tela. */
export function KanbanPriority({ label, dotClass, title }: { label: string; dotClass: string; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />
      {label}
    </span>
  );
}

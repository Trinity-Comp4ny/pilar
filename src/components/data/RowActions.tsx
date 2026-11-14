import type { LucideIcon } from "lucide-react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  /** Ação destrutiva (excluir): texto em tom de perigo e separada das demais. */
  destructive?: boolean;
  disabled?: boolean;
  /** Esconde a ação (permissão). */
  hidden?: boolean;
}

interface RowActionsProps {
  actions: RowAction[];
  /** Nome da linha, para o leitor de tela ("Mais ações de Fulano"). */
  label?: string;
}

/**
 * Menu de ações da linha de tabela: sempre os três pontinhos, sem coluna "Ações" no cabeçalho
 * (use `header: <span className="sr-only">Ações</span>`). Editar, excluir etc. moram dentro.
 */
export function RowActions({ actions, label }: RowActionsProps) {
  const visiveis = actions.filter((a) => !a.hidden);
  if (visiveis.length === 0) return null;
  const normais = visiveis.filter((a) => !a.destructive);
  const destrutivas = visiveis.filter((a) => a.destructive);

  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={label ? `Mais ações de ${label}` : "Mais ações"}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {normais.map((a) => (
            <DropdownMenuItem key={a.label} disabled={a.disabled} onClick={a.onClick}>
              {a.icon && <a.icon className="mr-2 h-3.5 w-3.5" aria-hidden />}
              {a.label}
            </DropdownMenuItem>
          ))}
          {normais.length > 0 && destrutivas.length > 0 && <DropdownMenuSeparator />}
          {destrutivas.map((a) => (
            <DropdownMenuItem
              key={a.label}
              disabled={a.disabled}
              onClick={a.onClick}
              className="text-destructive focus:text-destructive"
            >
              {a.icon && <a.icon className="mr-2 h-3.5 w-3.5" aria-hidden />}
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

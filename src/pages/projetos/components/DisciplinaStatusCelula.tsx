import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { disciplinaStatusOptions } from "@/types/projetos";

const STATUS_DOT: Record<string, string> = {
  Concluído: "bg-positive",
  "Em Andamento": "bg-status-progress",
  Pendente: "bg-status-planning",
  "Não Iniciado": "bg-status-unknown",
};

interface DisciplinaStatusCelulaProps {
  status: string | null | undefined;
  canEdit: boolean;
  /** Checklist do template com itens em aberto: ainda não dá para concluir. */
  checklistIncompleto: boolean;
  onChange: (status: string) => void;
}

/**
 * Status da disciplina na tabela do projeto. Pausada nasce do botão Pausar do detalhe (exige
 * motivo e congela o prazo): quem está pausada não troca por aqui e a opção não é escolhível.
 */
export function DisciplinaStatusCelula({
  status,
  canEdit,
  checklistIncompleto,
  onChange,
}: DisciplinaStatusCelulaProps) {
  const atual = status || "Não Iniciado";
  if (!canEdit) {
    return (
      <Badge variant="outline" className="text-[11px]">
        {atual}
      </Badge>
    );
  }

  return (
    <Select value={atual} onValueChange={onChange} disabled={atual === "Pausada"}>
      <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted px-2 -ml-2" aria-label="Status">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[atual])} />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {disciplinaStatusOptions.map((s) => (
          <SelectItem
            key={s}
            value={s}
            className="text-xs"
            disabled={(s === "Concluído" && checklistIncompleto) || s === "Pausada"}
            title={
              s === "Concluído" && checklistIncompleto
                ? "Conclua todos os itens do checklist antes"
                : s === "Pausada"
                  ? "Com a disciplina em andamento, abra o detalhe e use o botão Pausar para registrar o motivo"
                  : undefined
            }
          >
            <span className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
              {s}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

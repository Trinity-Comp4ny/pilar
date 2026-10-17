import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { disciplinaStatusOptions } from "@/types/projetos";

const DOT: Record<string, string> = {
  "Não Iniciado": "bg-status-unknown",
  "Em Andamento": "bg-status-progress",
  Concluído: "bg-status-done",
  Pendente: "bg-status-planning",
  Pausada: "bg-status-review",
};

/**
 * projeto_disciplinas.status é `text` livre no banco (sem enum), e hoje convivem
 * dois formatos no mesmo dado: "Em Andamento" (legado, Título Case) e
 * "em_andamento"/"concluida" (snake_case, sem acento) — achado da auditoria mobile
 * (08/09), que via o valor cru aparecer na tela porque nenhum batia com o mapa
 * antigo. Normaliza por substring em vez de listar literais, pra não quebrar nas
 * próximas variações de grafia. Devolve uma das opções de `disciplinaStatusOptions`.
 */
function statusCanonicoDaDisciplina(raw: string | null | undefined): string {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("conclu")) return "Concluído";
  if (s.includes("andamento")) return "Em Andamento";
  if (s.includes("pausad")) return "Pausada";
  if (s.includes("pendente")) return "Pendente";
  return "Não Iniciado";
}

interface DisciplinaStatusSelectProps {
  status: string | null | undefined;
  /** Sem permissão de edição, mostra só o rótulo. */
  canEdit: boolean;
  disciplina: string;
  onChange: (status: string) => void;
}

/** Status da disciplina numa linha de lista: clica e troca sem abrir a disciplina. */
export function DisciplinaStatusSelect({ status, canEdit, disciplina, onChange }: DisciplinaStatusSelectProps) {
  const atual = statusCanonicoDaDisciplina(status);
  const ponto = <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[atual])} />;

  if (!canEdit) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
        {ponto}
        {atual}
      </span>
    );
  }

  return (
    // Pausada nasce do botão Pausar (exige motivo): quem está pausada não troca por aqui.
    <Select value={atual} onValueChange={onChange} disabled={atual === "Pausada"}>
      <SelectTrigger
        aria-label={`Status de ${disciplina}`}
        className="h-7 w-auto shrink-0 gap-1.5 border-0 bg-transparent px-2 text-[11px] text-muted-foreground shadow-none hover:bg-muted"
      >
        {ponto}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {disciplinaStatusOptions.map((opt) => (
          <SelectItem key={opt} value={opt} disabled={opt === "Pausada"} className="text-xs">
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

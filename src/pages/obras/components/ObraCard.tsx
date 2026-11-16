import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, ExternalLink, Globe, MapPin } from "lucide-react";
import { AvatarStack } from "@/components/AvatarStack";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { KanbanCard } from "@/components/kanban/KanbanCard";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ObraResumo } from "@/pages/obras/hooks/useObras";

export const STATUS_OBRA = [
  { status: "planejada", titulo: "Planejada" },
  { status: "em_andamento", titulo: "Em andamento" },
  { status: "paralisada", titulo: "Paralisada" },
  { status: "concluida", titulo: "Concluída" },
] as const;

/** Dias até o fim previsto (negativo = atrasada). Obra concluída não cobra prazo. */
function prazoDaObra(obra: ObraResumo): { dias: number; atrasada: boolean } | null {
  if (!obra.data_fim_prevista || obra.status === "concluida") return null;
  const fim = new Date(`${obra.data_fim_prevista}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((fim.getTime() - hoje.getTime()) / 86400000);
  return { dias: Math.abs(dias), atrasada: dias < 0 };
}

/** Card de obra no quadro: mesma peça (`KanbanCard`) do card de projeto, com os dados da obra. */
export function ObraCard({
  obra,
  isDragging = false,
  canEdit = false,
  onMoveStatus,
}: {
  obra: ObraResumo;
  isDragging?: boolean;
  canEdit?: boolean;
  onMoveStatus?: (obra: ObraResumo, status: string) => void;
}) {
  const navigate = useNavigate();
  const prazo = prazoDaObra(obra);

  return (
    <KanbanCard
      onClick={() => navigate(`/obras/${obra.id}`)}
      isDragging={isDragging}
      eyebrow={
        <>
          {obra.cidade && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{obra.cidade}</span>
            </span>
          )}
          {obra.visivel_portal && obra.cliente_id && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 text-positive-strong"
              title="Cliente acompanha esta obra no portal"
            >
              <Globe className="h-3 w-3" aria-hidden="true" />
              Portal
            </span>
          )}
        </>
      }
      menu={
        <>
          <DropdownMenuItem onClick={() => navigate(`/obras/${obra.id}`)}>
            <ExternalLink className="mr-2 h-3.5 w-3.5" /> Abrir obra
          </DropdownMenuItem>
          {canEdit && onMoveStatus && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowRight className="mr-2 h-3.5 w-3.5" /> Mover para
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {STATUS_OBRA.filter((s) => s.status !== obra.status).map((s) => (
                    <DropdownMenuItem key={s.status} onClick={() => onMoveStatus(obra, s.status)}>
                      {s.titulo}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </>
      }
      title={obra.nome}
      subtitle={obra.projeto?.nome ?? "Sem projeto"}
      meta={
        <div className="flex w-full items-center gap-2">
          <Progress value={obra.avanco} className="h-1 flex-1" />
          <span className="w-7 text-right text-[11px] tabular-nums">{obra.avanco}%</span>
        </div>
      }
      footer={
        <>
          <span className="tabular-nums">
            {obra.data_fim_prevista ? `Fim ${formatDate(obra.data_fim_prevista)}` : "Sem prazo"}
          </span>
          <div className="flex items-center gap-2">
            {obra.responsavel?.nome && <AvatarStack pessoas={[obra.responsavel.nome]} max={1} size="xs" />}
            {prazo && (
              <Badge
                className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0 text-[11px] font-normal",
                  prazo.atrasada ? "bg-danger-soft text-danger-strong" : "bg-muted text-muted-foreground"
                )}
                title={prazo.atrasada ? `Atrasada há ${prazo.dias} dia(s)` : `Faltam ${prazo.dias} dia(s)`}
              >
                {prazo.atrasada && <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />}
                {prazo.atrasada ? `-${prazo.dias}d` : `${prazo.dias}d`}
              </Badge>
            )}
          </div>
        </>
      }
    />
  );
}

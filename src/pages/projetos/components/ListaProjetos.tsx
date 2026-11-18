import { parseISO } from "date-fns";
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { AvatarStack } from "@/components/AvatarStack";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { PROJECT_PRIORITY_CONFIG } from "@/constants";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { EtapaSelect } from "@/pages/projetos/components/EtapaSelect";
import { type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";
import { getDeadlineStatus, getProjectProgress, getResponsaveisList, type Projeto } from "@/types/projetos";

interface ListaProjetosProps {
  projetos: Projeto[];
  etapas: ProjetoEtapa[];
  canEdit: boolean;
  onCardClick: (projeto: Projeto) => void;
  onEditClick: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onMoverEtapa: (projetoId: string, etapaId: string) => void;
}

const prazoCurto = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const prazoComAno = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });

function PrazoProjeto({ projeto }: { projeto: Projeto }) {
  const previsao = projeto.data_previsao;
  if (!previsao) return <span className="text-muted-foreground">—</span>;

  const data = parseISO(previsao);
  if (Number.isNaN(data.getTime())) return <span className="text-muted-foreground">—</span>;

  const prazo = getDeadlineStatus(projeto);
  const formato = data.getFullYear() === new Date().getFullYear() ? prazoCurto : prazoComAno;
  return (
    <time
      dateTime={previsao}
      title={[prazoComAno.format(data), prazo?.label].filter(Boolean).join(" · ")}
      className={cn(
        "whitespace-nowrap",
        prazo?.status_data === "em_atraso" && "font-medium text-destructive",
        prazo?.status_data === "atencao" && "font-medium text-warning-strong"
      )}
    >
      {formato.format(data)}
    </time>
  );
}

function PrioridadeProjeto({ projeto }: { projeto: Projeto }) {
  const prioridade = projeto.prioridade && PROJECT_PRIORITY_CONFIG[projeto.prioridade];
  return prioridade ? (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("h-2 w-2 rounded-full", prioridade.dotColor)} />
      {prioridade.label}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

function ProgressoProjeto({ projeto }: { projeto: Projeto }) {
  const progresso = getProjectProgress(projeto.disciplinas);
  return (
    <div className="flex w-28 items-center gap-2">
      <Progress aria-label={`Progresso de ${projeto.nome}`} value={progresso} className="h-1.5 flex-1" />
      <span className="w-8 text-right text-xs tabular-nums" aria-hidden>
        {progresso}%
      </span>
    </div>
  );
}

function ResponsaveisProjeto({ projeto }: { projeto: Projeto }) {
  const nomes = (projeto.disciplinas ?? [])
    .flatMap((disciplina) => getResponsaveisList(disciplina))
    .map((responsavel) => responsavel.responsavel_nome?.trim())
    .filter(Boolean);

  return nomes.length > 0 ? (
    <div role="group" aria-label={`Responsáveis de ${projeto.nome}: ${[...new Set(nomes)].join(", ")}`}>
      <AvatarStack pessoas={nomes} max={3} />
    </div>
  ) : (
    <span className="text-muted-foreground" aria-label="Sem responsáveis">
      —
    </span>
  );
}

export function ListaProjetos({
  projetos,
  etapas,
  canEdit,
  onCardClick,
  onEditClick,
  onDelete,
  onMoverEtapa,
}: ListaProjetosProps) {
  const isMobile = useIsMobile();

  const columns: ColumnDef<Projeto>[] = [
    { key: "nome", header: "Projeto", className: "font-medium", mobile: "title", cell: (p) => p.nome },
    {
      key: "cliente",
      header: "Cliente",
      className: "text-muted-foreground",
      mobile: "subtitle",
      cell: (p) => (
        <>
          {p.cliente_nome || "—"}
          {isMobile && (p.prioridade || p.data_previsao) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {p.prioridade && <PrioridadeProjeto projeto={p} />}
              {p.data_previsao && <PrazoProjeto projeto={p} />}
            </div>
          )}
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "badge",
      cell: (p) => (
        <>
          <EtapaSelect
            projetoNome={p.nome}
            etapaId={p.etapa_id}
            statusFallback={p.status}
            etapas={etapas}
            canEdit={canEdit}
            onSelect={(etapaId) => onMoverEtapa(p.id, etapaId)}
          />
          {isMobile && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <ProgressoProjeto projeto={p} />
              <ResponsaveisProjeto projeto={p} />
            </div>
          )}
        </>
      ),
    },
    { key: "prioridade", header: "Prioridade", cell: (p) => <PrioridadeProjeto projeto={p} /> },
    { key: "prazo", header: "Prazo", cell: (p) => <PrazoProjeto projeto={p} /> },
    { key: "progresso", header: "Progresso", cell: (p) => <ProgressoProjeto projeto={p} /> },
    { key: "responsaveis", header: "Responsáveis", cell: (p) => <ResponsaveisProjeto projeto={p} /> },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      align: "end",
      className: "w-12 px-2",
      mobile: "trailing",
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Ações de ${p.nome}`}
              className="h-9 w-9 md:h-8 md:w-8"
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem asChild>
              <Link to={`/projetos/${p.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                Abrir projeto completo
              </Link>
            </DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuItem onSelect={() => onEditClick(p)}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(p.id)}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                  Excluir projeto
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="md:rounded-lg md:border md:bg-card">
      <DataTable
        columns={columns}
        data={{ rows: projetos, isPending: false, error: null }}
        rowKey={(p) => p.id}
        onRowClick={onCardClick}
        emptyMessage="Nenhum projeto nesta lista."
        density="compact"
      />
    </div>
  );
}

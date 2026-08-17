import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STATUS, type ProjectStatus } from "@/constants";
import { type Projeto } from "@/types/projetos";
import { type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";
import { AddColumnInline } from "@/components/kanban/AddColumnInline";
import { KanbanColumn } from "@/pages/projetos/components/KanbanColumn";
import { ProjectCard } from "@/pages/projetos/components/ProjectCard";

// Paleta das colunas (dot). Mesma família das âncoras semeadas no banco.
const CORES_ETAPA_PROJETO = [
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#64748b",
  "#10b981",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
] as const;

const BUCKETS: ProjectStatus[] = [
  PROJECT_STATUS.PLANEJAMENTO,
  PROJECT_STATUS.EM_ANDAMENTO,
  PROJECT_STATUS.REVISAO,
  PROJECT_STATUS.PARALISADO,
  PROJECT_STATUS.CONCLUIDO,
  PROJECT_STATUS.CANCELADO,
];

interface KanbanBoardProps {
  etapas: ProjetoEtapa[];
  collapsedColumns: Set<string>;
  loadingProjetos: boolean;
  canEdit: boolean;
  clientes: { id: string; nome: string }[];
  rentabilidadeMap: Record<string, number>;
  getProjetosByEtapa: (etapaId: string) => Projeto[];
  orfaos: Projeto[];
  onToggleColumn: (etapaId: string) => void;
  onCriarEtapa: (nome: string, cor: string, bucket: ProjectStatus) => Promise<boolean>;
  criandoEtapa: boolean;
  onRenomearEtapa: (etapa: ProjetoEtapa) => void;
  onReordenarEtapa: (etapaId: string, dir: -1 | 1) => void;
  onExcluirEtapa: (etapa: ProjetoEtapa) => void;
  onCardClick: (projeto: Projeto) => void;
  onEditClick: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onQuickAddCreated: () => void;
}

// Quadro Kanban (desktop): uma coluna por etapa (projeto_etapas) + a coluna de
// criação inline. Colunas são configuráveis por empresa; o status do projeto
// deriva do bucket da etapa (ver useProjetoEtapas / migration projeto_etapas).
export function KanbanBoard({
  etapas,
  collapsedColumns,
  loadingProjetos,
  canEdit,
  clientes,
  rentabilidadeMap,
  getProjetosByEtapa,
  orfaos,
  onToggleColumn,
  onCriarEtapa,
  criandoEtapa,
  onRenomearEtapa,
  onReordenarEtapa,
  onExcluirEtapa,
  onCardClick,
  onEditClick,
  onDelete,
  onQuickAddCreated,
}: KanbanBoardProps) {
  return (
    <div className="hidden md:flex gap-3 w-full h-full min-h-0 overflow-x-auto pb-2">
      {etapas.map((etapa, index) => (
        <KanbanColumn
          key={etapa.id}
          etapa={etapa}
          index={index}
          total={etapas.length}
          items={getProjetosByEtapa(etapa.id)}
          isCollapsed={collapsedColumns.has(etapa.id)}
          loadingProjetos={loadingProjetos}
          canEdit={canEdit}
          clientes={clientes}
          rentabilidadeMap={rentabilidadeMap}
          onToggleColumn={onToggleColumn}
          onRenomear={onRenomearEtapa}
          onReordenar={onReordenarEtapa}
          onExcluir={onExcluirEtapa}
          onCardClick={onCardClick}
          onEditClick={onEditClick}
          onDelete={onDelete}
          onQuickAddCreated={onQuickAddCreated}
        />
      ))}

      {/* Rede de segurança: projetos com status sem coluna equivalente (valor
          legado). Sem drop/ações — só para não sumirem da vista. */}
      {orfaos.length > 0 && (
        <div className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0 min-h-0">
          <div className="flex items-center gap-2 px-2 py-2.5">
            <span className="h-2 w-2 rounded-full flex-shrink-0 bg-status-unknown" />
            <h3 className="text-xs font-medium text-foreground/80 uppercase tracking-wide">Sem coluna</h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">{orfaos.length}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 rounded-lg bg-muted/30">
            {orfaos.map((projeto) => (
              <ProjectCard
                key={projeto.id}
                projeto={projeto}
                onClick={onCardClick}
                onEdit={onEditClick}
                onDelete={onDelete}
                canEdit={canEdit}
                margemBrutaPct={rentabilidadeMap[projeto.id] ?? null}
              />
            ))}
          </div>
        </div>
      )}

      {canEdit && (
        <AddColumnInline<ProjectStatus>
          colors={CORES_ETAPA_PROJETO}
          initialColor={CORES_ETAPA_PROJETO[1]}
          extraInitial={PROJECT_STATUS.EM_ANDAMENTO}
          busy={criandoEtapa}
          onCreate={(nome, cor, bucket) => onCriarEtapa(nome, cor, bucket)}
          renderExtra={(bucket, setBucket) => (
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Conta como</span>
              <Select value={bucket} onValueChange={(v) => setBucket(v as ProjectStatus)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUCKETS.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          triggerClassName="mt-9 w-[280px] rounded-lg"
          panelClassName="mt-9 w-[280px] self-start rounded-lg p-2.5"
        />
      )}
    </div>
  );
}

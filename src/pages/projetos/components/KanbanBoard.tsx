import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STATUS, type ProjectStatus } from "@/constants";
import { type Projeto } from "@/types/projetos";
import { CORES_ETAPA_PROJETO, type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";
import { AddColumnInline } from "@/components/kanban/AddColumnInline";
import { KANBAN_ADD_COLUMN_CLASSES, KANBAN_BOARD_CLASS } from "@/components/kanban/kanbanLayout";
import { KanbanColumn as ColunaPadrao } from "@/components/kanban/KanbanColumn";
import { KanbanColumn } from "@/pages/projetos/components/KanbanColumn";
import { ProjectCard } from "@/pages/projetos/components/ProjectCard";

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
  onEditarEtapa: (etapa: ProjetoEtapa) => void;
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
  onEditarEtapa,
  onReordenarEtapa,
  onExcluirEtapa,
  onCardClick,
  onEditClick,
  onDelete,
  onQuickAddCreated,
}: KanbanBoardProps) {
  return (
    <div className={`hidden md:flex ${KANBAN_BOARD_CLASS}`}>
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
          onEditar={onEditarEtapa}
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
        <ColunaPadrao id="sem-coluna" title="Sem coluna" color="#94a3b8" count={orfaos.length} dropDisabled>
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
        </ColunaPadrao>
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
          triggerClassName={KANBAN_ADD_COLUMN_CLASSES.trigger}
          panelClassName={KANBAN_ADD_COLUMN_CLASSES.panel}
        />
      )}
    </div>
  );
}

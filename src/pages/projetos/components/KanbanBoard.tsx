import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS, type ProjectStatus } from "@/constants";
import { type Projeto } from "@/types/projetos";
import { type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";
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

// "Add group" ao estilo ClickUp: campo inline com nome + cor + balde-âncora.
function NovaColunaInline({
  onCriar,
  criando,
}: {
  onCriar: (nome: string, cor: string, bucket: ProjectStatus) => Promise<boolean>;
  criando: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<string>(CORES_ETAPA_PROJETO[1]);
  const [bucket, setBucket] = useState<ProjectStatus>(PROJECT_STATUS.EM_ANDAMENTO);

  const fechar = () => {
    setAberto(false);
    setNome("");
    setCor(CORES_ETAPA_PROJETO[1]);
    setBucket(PROJECT_STATUS.EM_ANDAMENTO);
  };

  const criar = async () => {
    if (!nome.trim() || criando) return;
    const ok = await onCriar(nome, cor, bucket);
    if (ok) fechar();
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-9 flex h-11 w-[280px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> Nova coluna
      </button>
    );
  }

  return (
    <div className="mt-9 w-[280px] shrink-0 space-y-2 self-start rounded-lg border bg-card p-2.5 shadow-sm">
      <Input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            criar();
          } else if (e.key === "Escape") {
            fechar();
          }
        }}
        placeholder="Nome da coluna"
        className="h-8"
      />
      <div className="flex flex-wrap gap-1.5 px-0.5">
        {CORES_ETAPA_PROJETO.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCor(c)}
            aria-label={`Cor ${c}`}
            className={cn(
              "h-5 w-5 rounded-full ring-offset-2 ring-offset-card transition-shadow",
              cor === c && "ring-2 ring-foreground/60"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
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
      <div className="flex items-center gap-2">
        <Button variant="brand" size="sm" className="h-7" onClick={criar} disabled={!nome.trim() || criando}>
          Adicionar
        </Button>
        <Button variant="ghost" size="sm" className="h-7" onClick={fechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

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

      {canEdit && <NovaColunaInline onCriar={onCriarEtapa} criando={criandoEtapa} />}
    </div>
  );
}

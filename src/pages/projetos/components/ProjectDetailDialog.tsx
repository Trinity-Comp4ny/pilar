import { atribuicaoDisciplina } from "../lib/atribuicaoDisciplina";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Trash2,
  Edit,
  ExternalLink,
  AlertTriangle,
  MoreVertical,
  User,
  Calendar,
  DollarSign,
  Ruler,
  MapPin,
  Layers,
  Link2,
  MessageSquare,
  Plus,
  List,
  GitBranch,
  ArrowDownToLine,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG, PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import {
  type Projeto,
  type DisciplinaResponsavel,
  type ProjetoDisciplinaDB,
  type DisciplinaComentario,
  formatDateShort,
  getDeadlineStatus,
  getProjectProgress,
  getResponsaveisList,
  isDiscAtrasada,
  dbDisciplinaToLegacy,
} from "@/types/projetos";
import { useProjetoDisciplinas, useUpdateDisciplinaStatus } from "@/hooks/useProjetoDisciplinas";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { useProjetoDetail } from "../hooks/useProjetoDetail";
import { useAuth } from "@/contexts/AuthContext";
import { DisciplinaDetailDialog } from "./DisciplinaDetailDialog";
import { DisciplinaStatusSelect } from "./DisciplinaStatusSelect";
import { ProjetoAtividadesPanel } from "./ProjetoAtividadesPanel";
import { LinksEditor } from "@/components/LinksEditor";
import { useProjetoAtividades } from "../hooks/useProjetoAtividades";
import { ResponsiveDetailPanels } from "@/components/ui/responsive-detail-panels";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { ORDEM_LABEL, type OrdemDisc } from "../lib/ordemDisciplinas";
import { FluxoPipeline } from "./FluxoPipeline";
import { DisciplinaExcluirDialog } from "./DisciplinaConfirmDialogs";
import { DisciplinaConfirmDialogs } from "./DisciplinaConfirmDialogs";

// Campo da UI → coluna do banco (espelha o mapa de ProjetoDetailTabs).
const DISC_DB_FIELD: Partial<Record<keyof DisciplinaResponsavel, keyof ProjetoDisciplinaDB>> = {
  disciplina: "nome",
  data_inicio: "data_inicio",
  data_previsao: "data_fim",
  data_final: "data_fim_real",
  prioridade: "prioridade",
  justificativa_atraso: "justificativa_atraso",
  descricao: "descricao",
};

type VisaoDisc = "lista" | "fluxo";

const VISOES_DISC: ViewOption<VisaoDisc>[] = [
  { value: "lista", label: "Lista", icon: List },
  { value: "fluxo", label: "Fluxo", icon: GitBranch },
];

interface ProjectDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto: Projeto | null;
  canEdit: boolean;
  onEdit: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onProjectUpdated?: () => void;
}

export function ProjectDetailDialog({
  open,
  onOpenChange,
  projeto,
  canEdit,
  onEdit,
  onDelete,
  onProjectUpdated,
}: ProjectDetailDialogProps) {
  const formatCurrency = useMoneyMask();
  const navigate = useNavigate();
  const [, setUpdatingDisc] = useState<number | null>(null);
  const [justificativaDialog, setJustificativaDialog] = useState<{ discIdx: number; newStatus: string } | null>(null);
  const [justificativaText, setJustificativaText] = useState("");
  const [concludingDiscIdx, setConcludingDiscIdx] = useState<number | null>(null);
  const [concludingDate, setConcludingDate] = useState<string>("");

  const { data: dbDisciplinas = [] } = useProjetoDisciplinas(projeto?.id);
  const updateStatusMut = useUpdateDisciplinaStatus();
  const disciplinasLegacy = dbDisciplinas.map(dbDisciplinaToLegacy);

  // Reusa a infra de edição da disciplina (catálogo, pessoas, save). A query de
  // disciplinas é a mesma (deduplicada pelo React Query), então os índices batem.
  const {
    disciplinasCatalog,
    pessoas,
    getDbDisc,
    handleSaveDiscChanges,
    handleAddDisc,
    handleRemoveDisc,
    handleQuickUpdateProjeto,
  } = useProjetoDetail(projeto?.id);
  const { profile } = useAuth();
  const { links: projetoLinks, salvar: salvarAtividades } = useProjetoAtividades(projeto?.id ?? "");
  const [selectedDiscIdx, setSelectedDiscIdx] = useState<number | null>(null);
  const [isAddingDisc, setIsAddingDisc] = useState(false);
  const [newDisc, setNewDisc] = useState({ disciplina: "", responsavel_id: "" });
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [ordem, setOrdem] = useState<OrdemDisc>("padrao");
  const [visao, setVisao] = useState<VisaoDisc>("lista");

  const confirmarExcluirDisc = async () => {
    if (confirmDeleteIdx === null) return;
    const idx = confirmDeleteIdx;
    setConfirmDeleteIdx(null);
    await handleRemoveDisc(idx);
    onProjectUpdated?.();
  };

  const onAddDisc = async () => {
    if (!newDisc.disciplina || !newDisc.responsavel_id) return;
    await handleAddDisc(newDisc);
    setNewDisc({ disciplina: "", responsavel_id: "" });
    setIsAddingDisc(false);
    onProjectUpdated?.();
  };

  const autorNome =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || profile?.email || "Usuário";

  if (!projeto) return null;

  const selectedDisc = selectedDiscIdx != null ? (disciplinasLegacy[selectedDiscIdx] ?? null) : null;

  // Dependência = disciplinas da etapa anterior do fluxo (a etapa N só começa depois da N-1).
  const dependenciasDe = (disc: DisciplinaResponsavel): string[] => {
    if (disc.etapa == null) return [];
    const anteriores = disciplinasLegacy.filter((d) => d.etapa != null && d.etapa < disc.etapa!);
    if (anteriores.length === 0) return [];
    const etapaAnterior = Math.max(...anteriores.map((d) => d.etapa!));
    return anteriores.filter((d) => d.etapa === etapaAnterior).map((d) => d.disciplina);
  };

  const listaOrdenada = disciplinasLegacy
    .map((disc, idx) => ({ disc, idx }))
    .sort((a, b) => {
      if (ordem === "previsao") {
        const da = a.disc.data_previsao || "9999-12-31";
        const db = b.disc.data_previsao || "9999-12-31";
        return da.localeCompare(db);
      }
      if (ordem === "prioridade") {
        const wa = PROJECT_PRIORITY_CONFIG[a.disc.prioridade as ProjectPriority]?.sortWeight ?? 99;
        const wb = PROJECT_PRIORITY_CONFIG[b.disc.prioridade as ProjectPriority]?.sortWeight ?? 99;
        return wa - wb;
      }
      return a.idx - b.idx;
    });

  const saveDiscPatch = async (patch: Partial<ProjetoDisciplinaDB>) => {
    if (selectedDiscIdx == null) return;
    const dbDisc = getDbDisc(selectedDiscIdx);
    if (!dbDisc) return;
    await handleSaveDiscChanges({ ...dbDisc, ...patch });
    onProjectUpdated?.();
  };

  // Editar a disciplina pelo modal rico. Status passa pela via com travas
  // (justificativa/data), o resto grava direto.
  const discOnUpdateField = (field: keyof DisciplinaResponsavel, value: string) => {
    if (selectedDiscIdx == null) return;
    if (field === "status") {
      handleDisciplineStatusChange(selectedDiscIdx, value);
      return;
    }
    const dbField = DISC_DB_FIELD[field] ?? (field as keyof ProjetoDisciplinaDB);
    saveDiscPatch({ [dbField]: value } as Partial<ProjetoDisciplinaDB>);
  };
  const discOnUpdateResponsaveis = (ids: string[]) => {
    if (selectedDiscIdx == null) return;
    const updated = ids.map((id) => ({ id, nome: pessoas.find((p) => p.id === id)?.nome || "" }));
    saveDiscPatch({ responsaveis: updated });
  };

  const deadline = getDeadlineStatus(projeto);
  const progress = getProjectProgress(disciplinasLegacy);
  const statusConfig = PROJECT_STATUS_CONFIG[projeto.status];
  const priorityConfig = PROJECT_PRIORITY_CONFIG[projeto.prioridade as ProjectPriority];

  const applyDisciplineStatusChange = async (
    index: number,
    newStatus: string,
    justificativa?: string,
    dataFimRealOverride?: string
  ) => {
    const dbDisc = dbDisciplinas[index];
    if (!dbDisc) return;
    setUpdatingDisc(index);
    try {
      const resolvedDataFim =
        newStatus === "Concluído"
          ? dataFimRealOverride || (!dbDisc.data_fim_real ? new Date().toISOString().split("T")[0] : undefined)
          : undefined;
      await updateStatusMut.mutateAsync({
        id: dbDisc.id,
        projetoId: projeto.id,
        status: newStatus,
        justificativa_atraso: justificativa,
        data_fim_real: resolvedDataFim,
      });
      toast.success(`${dbDisc.nome}: ${newStatus}`);
      onProjectUpdated?.();
    } catch {
      toast.error("Erro ao atualizar");
    }
    setUpdatingDisc(null);
  };

  const handleDisciplineStatusChange = async (index: number, newStatus: string) => {
    if (newStatus === "Concluído") {
      const existing = dbDisciplinas[index]?.data_fim_real;
      setConcludingDate(existing || new Date().toISOString().split("T")[0]);
      setConcludingDiscIdx(index);
      return;
    }
    const disc = disciplinasLegacy[index];
    if (isDiscAtrasada(disc) && !disc.justificativa_atraso) {
      setJustificativaDialog({ discIdx: index, newStatus });
      setJustificativaText("");
      return;
    }
    await applyDisciplineStatusChange(index, newStatus);
  };

  const handleJustificativaConfirm = async () => {
    if (!justificativaDialog || !justificativaText.trim()) return;
    await applyDisciplineStatusChange(
      justificativaDialog.discIdx,
      justificativaDialog.newStatus,
      justificativaText.trim()
    );
    setJustificativaDialog(null);
    setJustificativaText("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-none w-[96vw] h-[92dvh] overflow-hidden p-0 gap-0 flex flex-col">
          {/* Header compacto */}
          <div className="shrink-0 px-4 pt-3 pb-4 md:px-8 md:pt-6 border-b bg-muted/50">
            <DialogHeader className="mb-0 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={statusConfig?.color}>{statusConfig?.label}</Badge>
                    {priorityConfig && (
                      <span
                        className={`text-3xs px-2 py-0.5 rounded-full font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}
                      >
                        {priorityConfig.label}
                      </span>
                    )}
                    {deadline && (
                      <Badge className={deadline.color + " text-3xs"}>
                        {deadline.label} {deadline.days > 0 ? `(${deadline.days}d)` : ""}
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-xl mt-1.5">{projeto.nome}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> {projeto.cliente_nome || "Sem cliente"}
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 items-center gap-1 pr-8">
                  <Button
                    size="sm"
                    variant="brand"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/projetos/${projeto.id}`);
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Abrir projeto completo
                  </Button>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Mais opções">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(projeto)}>
                          <Edit className="h-3.5 w-3.5 mr-2" /> Editar dados
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(projeto.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir projeto
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* Metadados em linha — substituem coluna lateral */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-positive-strong font-medium">
                <DollarSign className="h-3 w-3" /> {formatCurrency(projeto.valor_contrato)}
              </span>
              {projeto.area_m2 !== undefined && (
                <span className="flex items-center gap-1">
                  <Ruler className="h-3 w-3" /> {projeto.area_m2} m²
                </span>
              )}
              {projeto.data_inicio && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Início {formatDateShort(projeto.data_inicio)}
                </span>
              )}
              {projeto.data_previsao && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Previsão {formatDateShort(projeto.data_previsao)}
                </span>
              )}
              {projeto.localizacao && (
                <span className="flex items-center gap-1 truncate max-w-xs">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{projeto.localizacao}</span>
                </span>
              )}
            </div>

            {/* Progresso */}
            <div className="flex items-center gap-3 mt-3">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-xs font-semibold text-muted-foreground">{progress}%</span>
            </div>
          </div>

          {/* Conteúdo: disciplinas (redimensionável no desktop, abas no mobile) + atividades */}
          <ResponsiveDetailPanels
            className="flex-1 min-h-0"
            primaryLabel="Disciplinas"
            secondaryLabel="Atividades"
            primary={
              <div className="h-full overflow-y-auto px-4 py-4 md:px-8 md:py-6">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Disciplinas ({disciplinasLegacy.length})
                  </Label>
                  <div className="flex items-center gap-2">
                    {disciplinasLegacy.some((d) => d.etapa != null) && (
                      <ViewSwitcher
                        options={VISOES_DISC}
                        value={visao}
                        onChange={setVisao}
                        ariaLabel="Visualização das disciplinas"
                      />
                    )}
                    {visao === "lista" && disciplinasLegacy.length > 1 && (
                      <Select value={ordem} onValueChange={(v) => setOrdem(v as OrdemDisc)}>
                        <SelectTrigger className="h-8 w-[190px] text-xs" aria-label="Ordenar disciplinas">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ORDEM_LABEL) as OrdemDisc[]).map((o) => (
                            <SelectItem key={o} value={o} className="text-xs">
                              {ORDEM_LABEL[o]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {canEdit && !isAddingDisc && (
                      <Button size="xs" variant="brand" onClick={() => setIsAddingDisc(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar
                      </Button>
                    )}
                  </div>
                </div>

                {isAddingDisc && canEdit && (
                  <div className="rounded-lg border bg-primary/5 p-3 space-y-2 mb-3">
                    <Select
                      value={newDisc.disciplina}
                      onValueChange={(v) => setNewDisc((p) => ({ ...p, disciplina: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Disciplina" />
                      </SelectTrigger>
                      <SelectContent>
                        {disciplinasCatalog.map((d) => (
                          <SelectItem key={d.id} value={d.nome} className="text-xs">
                            {d.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={newDisc.responsavel_id}
                      onValueChange={(v) => setNewDisc((p) => ({ ...p, responsavel_id: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__terceirizada__">Serviço terceirizado</SelectItem>
                        {pessoas.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setIsAddingDisc(false);
                          setNewDisc({ disciplina: "", responsavel_id: "" });
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="xs"
                        variant="brand"
                        disabled={!newDisc.disciplina || !newDisc.responsavel_id}
                        onClick={onAddDisc}
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                )}

                {disciplinasLegacy.length === 0 ? (
                  !isAddingDisc && (
                    <div className="flex flex-col items-center gap-3 text-xs text-muted-foreground text-center py-8 border border-dashed rounded-lg">
                      <span>Nenhuma disciplina definida.</span>
                      {canEdit && (
                        <Button size="xs" variant="brand" onClick={() => setIsAddingDisc(true)}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar disciplina
                        </Button>
                      )}
                    </div>
                  )
                ) : visao === "fluxo" ? (
                  <FluxoPipeline
                    disciplinas={disciplinasLegacy}
                    onOpenDisciplina={(d) => {
                      const i = disciplinasLegacy.findIndex((x) => x.id === d.id && x.disciplina === d.disciplina);
                      if (i < 0) return;
                      setSelectedDiscIdx(i);
                      onOpenChange(false);
                    }}
                    projetoDataPrevisao={projeto.data_previsao}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {listaOrdenada.map(({ disc, idx }) => {
                      const resps = getResponsaveisList(disc);
                      const atrasada = isDiscAtrasada(disc);
                      const prioDisc = PROJECT_PRIORITY_CONFIG[disc.prioridade as ProjectPriority];
                      const deps = dependenciasDe(disc);

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-center gap-1 rounded-lg border pr-1 transition-colors",
                            atrasada ? "bg-danger-soft/40 border-danger-soft-border" : "hover:bg-muted/40"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDiscIdx(idx);
                              onOpenChange(false); // fecha o modal do projeto: um overlay só
                            }}
                            className="min-w-0 flex-1 rounded-lg p-3 text-left"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{disc.disciplina}</span>
                                  {disc.etapa != null && (
                                    <span className="text-3xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                      Etapa {disc.etapa}
                                    </span>
                                  )}
                                  {prioDisc && (
                                    <span
                                      className={`text-3xs px-1.5 py-0.5 rounded-full font-medium ${prioDisc.bgColor} ${prioDisc.color}`}
                                    >
                                      {prioDisc.label}
                                    </span>
                                  )}
                                  {atrasada && (
                                    <span className="text-3xs px-1.5 py-0.5 rounded-full font-semibold bg-danger-soft text-danger-strong flex items-center gap-1">
                                      <AlertTriangle size={10} /> Atrasada
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {resps.map((r) => r.responsavel_nome).join(", ") || "Sem responsável"}
                                  </span>
                                  {disc.data_previsao && (
                                    <span className="inline-flex items-center gap-1">
                                      <Calendar className="h-3 w-3" /> Previsão {formatDateShort(disc.data_previsao)}
                                    </span>
                                  )}
                                  {disc.data_final && (
                                    <span className="inline-flex items-center gap-1 text-positive-strong">
                                      <Calendar className="h-3 w-3" /> Concluída {formatDateShort(disc.data_final)}
                                    </span>
                                  )}
                                </div>
                                {deps.length > 0 && (
                                  <p className="mt-1 flex items-center gap-1 text-2xs text-muted-foreground">
                                    <ArrowDownToLine className="h-3 w-3 rotate-90" aria-hidden="true" />
                                    Depende de: {deps.join(", ")}
                                  </p>
                                )}
                                {atrasada && disc.justificativa_atraso && (
                                  <p className="text-3xs text-danger-mid mt-1 italic line-clamp-1">
                                    {disc.justificativa_atraso}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                          <DisciplinaStatusSelect
                            status={disc.status}
                            canEdit={canEdit}
                            disciplina={disc.disciplina}
                            onChange={(status) => handleDisciplineStatusChange(idx, status)}
                          />
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 text-muted-foreground hover:text-danger-mid"
                              onClick={() => setConfirmDeleteIdx(idx)}
                              aria-label="Excluir disciplina"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t">
                  <Label htmlFor="obs-projeto" className="text-3xs uppercase text-muted-foreground">
                    Observações
                  </Label>
                  <Textarea
                    key={projeto.id + (projeto.observacao ?? "")}
                    id="obs-projeto"
                    defaultValue={projeto.observacao ?? ""}
                    readOnly={!canEdit}
                    placeholder="Escreva observações do projeto…"
                    className="mt-1 min-h-[96px] text-xs"
                    onBlur={async (e) => {
                      const v = e.target.value;
                      if (v === (projeto.observacao ?? "")) return;
                      await handleQuickUpdateProjeto({ observacao: v });
                      onProjectUpdated?.();
                    }}
                  />
                </div>

                <div className="mt-6 pt-5 border-t">
                  <Label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" /> Links
                  </Label>
                  <LinksEditor value={projetoLinks} onChange={(n) => salvarAtividades.mutate({ links: n })} />
                </div>
              </div>
            }
            secondary={
              <div className="flex h-full flex-col bg-muted/10 px-4 py-4 md:px-6 md:py-5">
                <Label className="mb-3 flex shrink-0 items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" /> Atividades
                </Label>
                <div className="min-h-0 flex-1">
                  <ProjetoAtividadesPanel projetoId={projeto.id} pessoas={pessoas} autorNome={autorNome} />
                </div>
              </div>
            }
          />
        </DialogContent>
      </Dialog>

      {/* Modal rico da disciplina (abre ao clicar numa disciplina) */}
      <DisciplinaDetailDialog
        open={selectedDiscIdx !== null}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedDiscIdx(null);
            onOpenChange(true); // volta ao modal do projeto
          }
        }}
        disciplina={selectedDisc}
        disciplinas={disciplinasCatalog}
        pessoas={pessoas}
        onUpdateField={discOnUpdateField}
        onUpdateResponsaveis={discOnUpdateResponsaveis}
        onUpdateExecucao={
          canEdit
            ? (tipo, prestador, ids) => saveDiscPatch(atribuicaoDisciplina(tipo, prestador, ids, pessoas))
            : undefined
        }
        onUpdateLabels={(n) => saveDiscPatch({ labels: n })}
        onUpdateLinks={(n) => saveDiscPatch({ links: n })}
        onUpdateComentarios={(n: DisciplinaComentario[]) => saveDiscPatch({ comentarios: n })}
        onUpdateDescricao={(n) => saveDiscPatch({ descricao: n })}
        onUpdateHorasEstimadas={(n) => saveDiscPatch({ horas_estimadas: n })}
        onUpdateHorasRealizadas={(n) => saveDiscPatch({ horas_realizadas: n })}
        autorNome={autorNome}
        projetoDataInicio={projeto.data_inicio}
        projetoDataPrevisao={projeto.data_previsao}
        onDelete={
          canEdit && selectedDiscIdx !== null
            ? async () => {
                const idx = selectedDiscIdx;
                setSelectedDiscIdx(null);
                onOpenChange(true);
                await handleRemoveDisc(idx);
                onProjectUpdated?.();
              }
            : undefined
        }
      />

      <DisciplinaExcluirDialog
        nome={confirmDeleteIdx !== null ? disciplinasLegacy[confirmDeleteIdx]?.disciplina : undefined}
        open={confirmDeleteIdx !== null}
        onClose={() => setConfirmDeleteIdx(null)}
        onConfirm={confirmarExcluirDisc}
      />

      <DisciplinaConfirmDialogs
        disciplinas={disciplinasLegacy}
        concludingDiscIdx={concludingDiscIdx}
        setConcludingDiscIdx={setConcludingDiscIdx}
        concludingDate={concludingDate}
        setConcludingDate={setConcludingDate}
        onConcluir={(idx, date) => applyDisciplineStatusChange(idx, "Concluído", undefined, date)}
        justificativaDialog={justificativaDialog}
        setJustificativaDialog={setJustificativaDialog}
        justificativaText={justificativaText}
        setJustificativaText={setJustificativaText}
        onJustificativaConfirm={handleJustificativaConfirm}
      />
    </>
  );
}

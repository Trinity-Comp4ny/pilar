import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DatePicker } from "@/components/ui/date-picker";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
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
import { ProjetoAtividadesPanel } from "./ProjetoAtividadesPanel";
import { LinksEditor } from "@/components/LinksEditor";
import { useProjetoAtividades } from "../hooks/useProjetoAtividades";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

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

interface ProjectDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto: Projeto | null;
  canEdit: boolean;
  onEdit: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onProjectUpdated?: () => void;
}

const DISC_STATUS_DOT: Record<string, string> = {
  Concluído: "bg-status-done",
  "Em Andamento": "bg-status-progress",
  Pendente: "bg-status-planning",
  "Não Iniciado": "bg-status-unknown",
};

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
  const { disciplinasCatalog, pessoas, getDbDisc, handleSaveDiscChanges, handleAddDisc, handleRemoveDisc } =
    useProjetoDetail(projeto?.id);
  const { profile } = useAuth();
  const { links: projetoLinks, salvar: salvarAtividades } = useProjetoAtividades(projeto?.id ?? "");
  const [selectedDiscIdx, setSelectedDiscIdx] = useState<number | null>(null);
  const [isAddingDisc, setIsAddingDisc] = useState(false);
  const [newDisc, setNewDisc] = useState({ disciplina: "", responsavel_id: "" });
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

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
  const discOnUpdateResponsavel = (val: string, nome: string) => {
    if (selectedDiscIdx == null) return;
    const dbDisc = getDbDisc(selectedDiscIdx);
    const resps = dbDisc?.responsaveis ?? [];
    const updated = resps.length > 0 ? resps.map((r, i) => (i === 0 ? { id: val, nome } : r)) : [{ id: val, nome }];
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
        <DialogContent className="max-w-none w-[96vw] h-[92vh] overflow-hidden p-0 gap-0 flex flex-col">
          {/* Header compacto */}
          <div className="flex-shrink-0 px-8 pt-6 pb-4 border-b bg-muted/50">
            <DialogHeader className="mb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {projeto.codigo_projeto && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {projeto.codigo_projeto}
                      </span>
                    )}
                    <Badge className={statusConfig?.color}>{statusConfig?.label}</Badge>
                    {priorityConfig && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}
                      >
                        {priorityConfig.label}
                      </span>
                    )}
                    {deadline && (
                      <Badge className={deadline.color + " text-[10px]"}>
                        {deadline.label} {deadline.days > 0 ? `(${deadline.days}d)` : ""}
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-xl mt-1.5">{projeto.nome}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> {projeto.cliente_nome || "Sem cliente"}
                  </DialogDescription>
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1" aria-label="Mais opções">
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
                  <MapPin className="h-3 w-3 flex-shrink-0" />
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

          {/* Conteúdo: disciplinas (redimensionável) + atividades do projeto */}
          <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
            <ResizablePanel defaultSize={68} minSize={45}>
              <div className="h-full overflow-y-auto px-8 py-6">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Disciplinas ({disciplinasLegacy.length})
                  </Label>
                  {canEdit && !isAddingDisc && (
                    <Button size="sm" variant="brand" className="h-7 text-xs" onClick={() => setIsAddingDisc(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar
                    </Button>
                  )}
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
                        {pessoas.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setIsAddingDisc(false);
                          setNewDisc({ disciplina: "", responsavel_id: "" });
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="brand"
                        className="h-7 text-xs"
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
                        <Button size="sm" variant="brand" className="h-7 text-xs" onClick={() => setIsAddingDisc(true)}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar disciplina
                        </Button>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-1.5">
                    {disciplinasLegacy.map((disc, idx) => {
                      const resps = getResponsaveisList(disc);
                      const atrasada = isDiscAtrasada(disc);

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
                                  {atrasada && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-danger-soft text-danger-strong flex items-center gap-1">
                                      <AlertTriangle size={10} /> Atrasada
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
                                {atrasada && disc.justificativa_atraso && (
                                  <p className="text-[10px] text-danger-mid mt-1 italic line-clamp-1">
                                    {disc.justificativa_atraso}
                                  </p>
                                )}
                              </div>

                              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-shrink-0">
                                <span
                                  className={cn("h-2 w-2 rounded-full", DISC_STATUS_DOT[disc.status || "Não Iniciado"])}
                                />
                                {disc.status || "Não Iniciado"}
                              </span>
                            </div>
                          </button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-danger-mid"
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

                {projeto.observacao && (
                  <div className="mt-4 pt-3 border-t">
                    <Label className="text-[10px] uppercase text-muted-foreground">Observações</Label>
                    <p className="text-xs text-ink-soft mt-1">{projeto.observacao}</p>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t">
                  <Label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" /> Links
                  </Label>
                  <LinksEditor value={projetoLinks} onChange={(n) => salvarAtividades.mutate({ links: n })} />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={32} minSize={22}>
              <div className="flex h-full flex-col bg-muted/10 px-6 py-5">
                <Label className="mb-3 flex flex-shrink-0 items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" /> Atividades
                </Label>
                <div className="min-h-0 flex-1">
                  <ProjetoAtividadesPanel projetoId={projeto.id} pessoas={pessoas} autorNome={autorNome} />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-2 px-6 py-3 border-t bg-muted/30">
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/projetos/${projeto.id}`);
              }}
              variant="brand"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Abrir projeto completo
            </Button>
          </div>
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
        onUpdateResponsavel={discOnUpdateResponsavel}
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

      {/* Confirmação de exclusão de disciplina */}
      <AlertDialog open={confirmDeleteIdx !== null} onOpenChange={(o) => !o && setConfirmDeleteIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir disciplina</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteIdx !== null && disciplinasLegacy[confirmDeleteIdx]
                ? `A disciplina "${disciplinasLegacy[confirmDeleteIdx].disciplina}" e seus dados serão removidos. Esta ação não pode ser desfeita.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmarExcluirDisc}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de conclusão */}
      <AlertDialog
        open={concludingDiscIdx !== null}
        onOpenChange={(o) => {
          if (!o) setConcludingDiscIdx(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar conclusão</AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina{" "}
              <strong>{concludingDiscIdx !== null && disciplinasLegacy[concludingDiscIdx]?.disciplina}</strong> será
              marcada como <strong>Concluída</strong>. Informe a data real da entrega abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs">Data final</Label>
            <DatePicker
              value={concludingDate || undefined}
              onChange={(v) => setConcludingDate(v || "")}
              maxDate={new Date().toISOString().split("T")[0]}
            />
            <p className="text-[11px] text-muted-foreground">
              Use a data em que o trabalho foi de fato entregue, não a data administrativa de hoje.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-positive hover:bg-positive/90"
              disabled={!concludingDate}
              onClick={async () => {
                if (concludingDiscIdx === null || !concludingDate) return;
                const idx = concludingDiscIdx;
                const date = concludingDate;
                setConcludingDiscIdx(null);
                await applyDisciplineStatusChange(idx, "Concluído", undefined, date);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Justificativa de atraso */}
      <AlertDialog
        open={!!justificativaDialog}
        onOpenChange={(o) => {
          if (!o) {
            setJustificativaDialog(null);
            setJustificativaText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger-mid" />
              Justificativa de atraso obrigatória
            </AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina{" "}
              <strong>
                {justificativaDialog !== null && disciplinasLegacy[justificativaDialog.discIdx]?.disciplina}
              </strong>{" "}
              está atrasada. Informe a justificativa para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-sm mb-2 block">Justificativa</Label>
            <Textarea
              value={justificativaText}
              onChange={(e) => setJustificativaText(e.target.value)}
              placeholder="Explique o motivo do atraso..."
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleJustificativaConfirm}
              disabled={!justificativaText.trim()}
              className="bg-brand hover:bg-brand/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

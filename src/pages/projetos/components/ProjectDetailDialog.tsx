import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG, PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import {
  type Projeto,
  disciplinaStatusOptions,
  formatCurrency,
  formatDateShort,
  getDeadlineStatus,
  getProjectProgress,
  getResponsaveisList,
  isDiscAtrasada,
  dbDisciplinaToLegacy,
} from "@/types/projetos";
import { useProjetoDisciplinas, useUpdateDisciplinaStatus } from "@/hooks/useProjetoDisciplinas";

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
  Concluído: "bg-positive/100",
  "Em Andamento": "bg-blue-500",
  Pendente: "bg-amber-500",
  "Não Iniciado": "bg-gray-400",
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
  const navigate = useNavigate();
  const [updatingDisc, setUpdatingDisc] = useState<number | null>(null);
  const [justificativaDialog, setJustificativaDialog] = useState<{ discIdx: number; newStatus: string } | null>(null);
  const [justificativaText, setJustificativaText] = useState("");
  const [concludingDiscIdx, setConcludingDiscIdx] = useState<number | null>(null);
  const [concludingDate, setConcludingDate] = useState<string>("");

  const { data: dbDisciplinas = [] } = useProjetoDisciplinas(projeto?.id);
  const updateStatusMut = useUpdateDisciplinaStatus();
  const disciplinasLegacy = dbDisciplinas.map(dbDisciplinaToLegacy);

  if (!projeto) return null;

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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {/* Header compacto */}
          <div className="px-6 pt-6 pb-4 border-b bg-gray-50/50">
            <DialogHeader className="mb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-lg">{projeto.codigo_projeto}</DialogTitle>
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
                  <DialogDescription className="text-sm text-muted-foreground mt-1">{projeto.nome}</DialogDescription>
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
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {projeto.cliente_nome || "—"}
              </span>
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

          {/* Conteúdo: foco em disciplinas */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Disciplinas ({disciplinasLegacy.length})
              </Label>
            </div>

            {disciplinasLegacy.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded-lg">
                Nenhuma disciplina definida.
              </div>
            ) : (
              <div className="space-y-1.5">
                {disciplinasLegacy.map((disc, idx) => {
                  const resps = getResponsaveisList(disc);
                  const atrasada = isDiscAtrasada(disc);

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-lg border p-3 hover:bg-muted/30 transition-colors",
                        atrasada && "bg-red-50/40 border-red-100"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{disc.disciplina}</span>
                            {atrasada && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                                <AlertTriangle size={10} /> Atrasada
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {resps.map((r) => r.responsavel_nome).join(", ") || "Sem responsável"}
                            {disc.data_previsao && ` · Previsão ${formatDateShort(disc.data_previsao)}`}
                          </p>
                          {atrasada && disc.justificativa_atraso && (
                            <p className="text-[10px] text-red-600 mt-1 italic line-clamp-1">
                              {disc.justificativa_atraso}
                            </p>
                          )}
                        </div>

                        {canEdit ? (
                          <Select
                            value={disc.status || "Não Iniciado"}
                            onValueChange={(val) => handleDisciplineStatusChange(idx, val)}
                            disabled={updatingDisc === idx}
                          >
                            <SelectTrigger className="h-7 w-[140px] text-[11px]">
                              <span className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "h-2 w-2 rounded-full flex-shrink-0",
                                    DISC_STATUS_DOT[disc.status || "Não Iniciado"]
                                  )}
                                />
                                <SelectValue />
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {disciplinaStatusOptions.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <span className={cn("h-2 w-2 rounded-full", DISC_STATUS_DOT[s])} />
                                    {s}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-[11px]">
                            {disc.status || "Não Iniciado"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {projeto.observacao && (
              <div className="mt-4 pt-3 border-t">
                <Label className="text-[10px] uppercase text-muted-foreground">Observações</Label>
                <p className="text-xs text-gray-700 mt-1">{projeto.observacao}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t bg-gray-50/30">
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
              <AlertTriangle className="h-5 w-5 text-red-500" />
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

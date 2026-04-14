import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { User, DollarSign, Ruler, Trash2, Edit, MapPin, ExternalLink, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PROJECT_STATUS_CONFIG, PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import { type Projeto, disciplinaStatusOptions, formatCurrency, formatDate, formatDateShort, getDeadlineStatus, getProjectProgress, getResponsaveisList, isDiscAtrasada } from "@/pages/projetos/types";
import { supabase } from "@/integrations/supabase/client";

interface ProjectDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto: Projeto | null;
  canEdit: boolean;
  onEdit: (projeto: Projeto) => void;
  onDelete: (id: string) => void;
  onProjectUpdated?: () => void;
}

const DISC_STATUS_COLORS: Record<string, string> = {
  "Concluído": "bg-green-100 text-green-800 border-green-200",
  "Em Andamento": "bg-blue-100 text-blue-800 border-blue-200",
  "Pendente": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Não Iniciado": "bg-gray-100 text-gray-600 border-gray-200",
};

export function ProjectDetailDialog({ open, onOpenChange, projeto, canEdit, onEdit, onDelete, onProjectUpdated }: ProjectDetailDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [updatingDisc, setUpdatingDisc] = useState<number | null>(null);
  const [justificativaDialog, setJustificativaDialog] = useState<{ discIdx: number; newStatus: string } | null>(null);
  const [justificativaText, setJustificativaText] = useState("");

  if (!projeto) return null;

  const deadline = getDeadlineStatus(projeto);
  const progress = getProjectProgress(projeto.disciplinas);
  const statusConfig = PROJECT_STATUS_CONFIG[projeto.status];

  const applyDisciplineStatusChange = async (index: number, newStatus: string, justificativa?: string) => {
    setUpdatingDisc(index);
    const updatedDisciplinas = [...projeto.disciplinas];
    updatedDisciplinas[index] = {
      ...updatedDisciplinas[index],
      status: newStatus,
      ...(newStatus === "Concluído" && !updatedDisciplinas[index].data_final
        ? { data_final: new Date().toISOString().split("T")[0] }
        : {}),
      ...(justificativa !== undefined ? { justificativa_atraso: justificativa } : {}),
    };

    const { error } = await supabase
      .from("projetos")
      .update({ disciplinas: updatedDisciplinas })
      .eq("id", projeto.id);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
    } else {
      projeto.disciplinas = updatedDisciplinas;
      toast({ title: `${updatedDisciplinas[index].disciplina}: ${newStatus}` });
      onProjectUpdated?.();
    }
    setUpdatingDisc(null);
  };

  const handleDisciplineStatusChange = async (index: number, newStatus: string) => {
    const disc = projeto.disciplinas[index];
    if (isDiscAtrasada(disc) && newStatus !== "Concluído" && !disc.justificativa_atraso) {
      setJustificativaDialog({ discIdx: index, newStatus });
      setJustificativaText("");
      return;
    }
    await applyDisciplineStatusChange(index, newStatus);
  };

  const handleJustificativaConfirm = async () => {
    if (!justificativaDialog || !justificativaText.trim()) return;
    await applyDisciplineStatusChange(justificativaDialog.discIdx, justificativaDialog.newStatus, justificativaText.trim());
    setJustificativaDialog(null);
    setJustificativaText("");
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header compacto */}
        <div className="px-6 pt-6 pb-4 border-b bg-gray-50/50">
          <DialogHeader className="mb-0">
            <div className="flex items-center gap-3 flex-wrap">
              <DialogTitle className="text-lg">{projeto.codigo_projeto}</DialogTitle>
              <Badge className={statusConfig?.color}>{statusConfig?.label}</Badge>
              {(() => {
                const pc = PROJECT_PRIORITY_CONFIG[projeto.prioridade as ProjectPriority];
                return pc ? (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pc.bgColor} ${pc.color}`}>
                    {pc.label}
                  </span>
                ) : null;
              })()}
              {deadline && (
                <Badge className={deadline.color + " text-[10px]"}>
                  {deadline.label} {deadline.days > 0 ? `(${deadline.days}d)` : ""}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{projeto.nome}</p>
          </DialogHeader>

          {/* Progresso */}
          <div className="flex items-center gap-3 mt-3">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-xs font-semibold text-muted-foreground">{progress}%</span>
          </div>
        </div>

        {/* Conteúdo em 2 colunas */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-0 divide-y md:divide-y-0 md:divide-x">
          {/* Coluna esquerda: Informações do projeto */}
          <div className="md:col-span-2 p-5 space-y-4">
            <div className="space-y-3">
              <InfoRow icon={User} label="Cliente" value={projeto.cliente_nome || "—"} />
              <InfoRow icon={DollarSign} label="Contrato" value={formatCurrency(projeto.valor_contrato)} valueClass="text-green-700 font-semibold" />
              <InfoRow icon={Ruler} label="Área" value={`${projeto.area_m2 || 0} m²`} />
              {projeto.localizacao && <InfoRow icon={MapPin} label="Local" value={projeto.localizacao} />}

              <div className="pt-2 border-t">
                <div className="grid grid-cols-3 gap-2">
                  <DateBlock label="Início" value={projeto.data_inicio} />
                  <DateBlock label="Previsão" value={projeto.data_previsao} />
                  <DateBlock label="Final" value={projeto.data_final} />
                </div>
              </div>

              {projeto.observacao && (
                <div className="pt-2 border-t">
                  <Label className="text-[10px] uppercase text-muted-foreground">Observações</Label>
                  <p className="text-xs text-gray-700 mt-1">{projeto.observacao}</p>
                </div>
              )}
            </div>
          </div>

          {/* Coluna direita: Disciplinas com edição inline */}
          <div className="md:col-span-3 p-5">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Disciplinas ({projeto.disciplinas.length})
              </Label>
            </div>

            {projeto.disciplinas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma disciplina definida.</p>
            ) : (
              <div className="space-y-2">
                {projeto.disciplinas.map((disc, idx) => {
                  const statusColor = DISC_STATUS_COLORS[disc.status || "Não Iniciado"] || DISC_STATUS_COLORS["Não Iniciado"];
                  const resps = getResponsaveisList(disc);

                  return (
                    <div key={idx} className="rounded-lg border p-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{disc.disciplina}</p>
                            {disc.prioridade && (() => {
                              const dpc = PROJECT_PRIORITY_CONFIG[disc.prioridade as ProjectPriority];
                              return dpc ? (
                                <span className={`text-[9px] px-1.5 py-0 rounded-full font-medium ${dpc.bgColor} ${dpc.color}`}>
                                  {dpc.label}
                                </span>
                              ) : null;
                            })()}
                            {isDiscAtrasada(disc) && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700 flex items-center gap-0.5">
                                <AlertTriangle size={10} /> Atrasada
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {resps.map((r) => r.responsavel_nome).join(", ") || "Sem responsável"}
                          </p>
                          {isDiscAtrasada(disc) && disc.justificativa_atraso && (
                            <p className="text-[10px] text-red-600 mt-0.5 italic">
                              Justificativa: {disc.justificativa_atraso}
                            </p>
                          )}
                        </div>

                        {canEdit ? (
                          <Select
                            value={disc.status || "Não Iniciado"}
                            onValueChange={(val) => handleDisciplineStatusChange(idx, val)}
                            disabled={updatingDisc === idx}
                          >
                            <SelectTrigger className={`h-7 w-[130px] text-[11px] border ${statusColor}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {disciplinaStatusOptions.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={statusColor + " text-[11px]"}>
                            {disc.status || "Não Iniciado"}
                          </Badge>
                        )}
                      </div>

                      {/* Responsáveis com datas individuais */}
                      <div className="mt-2 space-y-1.5">
                        {resps.map((resp, rIdx) => (
                          <div key={rIdx} className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground min-w-[80px] truncate flex items-center gap-1">
                              <User className="h-3 w-3 shrink-0" />
                              {resp.responsavel_nome}
                            </span>
                            <div className="flex items-center gap-3">
                              {resp.data_inicio && <span>Início: {formatDateShort(resp.data_inicio)}</span>}
                              {resp.data_previsao && <span>Prev: {formatDateShort(resp.data_previsao)}</span>}
                              {resp.data_final && <span className="text-green-700 font-medium">Final: {formatDateShort(resp.data_final)}</span>}
                              {!resp.data_inicio && !resp.data_previsao && !resp.data_final && <span>Sem datas</span>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {disc.observacoes && disc.observacoes.length > 0 && (
                        <p className="text-[11px] text-gray-500 mt-1.5 italic line-clamp-1">
                          "{disc.observacoes[disc.observacoes.length - 1].texto}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer com ações */}
        <div className="flex items-center gap-2 px-6 py-4 border-t bg-gray-50/30">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { onOpenChange(false); navigate(`/projetos/${projeto.id}`); }}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Página Completa
          </Button>

          <div className="flex-1" />

          {canEdit && (
            <>
              <Button
                size="sm"
                onClick={() => onEdit(projeto)}
                className="bg-accent-orange hover:bg-accent-orange/90 text-white"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Editar Projeto
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onDelete(projeto.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog de justificativa obrigatória para atraso */}
    <AlertDialog open={!!justificativaDialog} onOpenChange={(open) => { if (!open) { setJustificativaDialog(null); setJustificativaText(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Justificativa de Atraso Obrigatória
          </AlertDialogTitle>
          <AlertDialogDescription>
            A disciplina <strong>{justificativaDialog !== null && projeto?.disciplinas[justificativaDialog.discIdx]?.disciplina}</strong> está atrasada.
            É necessário informar uma justificativa para continuar.
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
            className="bg-accent-orange hover:bg-accent-orange/90"
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function InfoRow({ icon: Icon, label, value, valueClass = "" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
        <p className={`text-sm truncate ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

function DateBlock({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{formatDate(value)}</p>
    </div>
  );
}

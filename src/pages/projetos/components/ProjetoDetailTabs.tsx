import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { User, Calendar, Edit, Plus, Trash2, MessageSquare, ChevronDown, Layers, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_PRIORITY, PROJECT_PRIORITY_CONFIG, PRIORITY_OPTIONS, type ProjectPriority } from "@/constants";
import {
  type Projeto,
  type DisciplinaResponsavel,
  type ProjetoDisciplinaDB,
  disciplinaStatusOptions,
  formatDateShort,
  getResponsaveisList,
  isDiscAtrasada,
} from "@/types/projetos";
import { CronogramaTab } from "./CronogramaTab";
import { PagamentosTab } from "./PagamentosTab";
import { ProjectBudgetTab } from "./ProjectBudgetTab";
import { BillingMilestonesTab } from "./BillingMilestonesTab";
import { EscopoTab } from "./EscopoTab";
import { BurnRateChart } from "./BurnRateChart";
import { EntregaveisTab } from "./EntregaveisTab";

interface ProjetoDetailTabsProps {
  projeto: Projeto;
  canEdit: boolean;
  disciplinasLegacy: DisciplinaResponsavel[];
  dbDisciplinas: ProjetoDisciplinaDB[];
  disciplinasCatalog: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  getDbDisc: (idx: number) => ProjetoDisciplinaDB | undefined;
  applyDiscStatusChange: (idx: number, newStatus: string, justificativa?: string) => Promise<void>;
  handleRemoveDisc: (idx: number) => Promise<void>;
  handleAddDisc: (newDisc: { disciplina: string; responsavel_id: string }) => Promise<void>;
  handleSaveDiscChanges: (editingDiscLocal: ProjetoDisciplinaDB) => Promise<void>;
  handleAddResponsavel: (discIdx: number, responsavelId: string) => Promise<void>;
  handleRemoveResponsavel: (discIdx: number, respIdx: number) => Promise<void>;
}

export function ProjetoDetailTabs({
  projeto,
  canEdit,
  disciplinasLegacy,
  dbDisciplinas,
  disciplinasCatalog,
  pessoas,
  getDbDisc,
  applyDiscStatusChange,
  handleRemoveDisc,
  handleAddDisc,
  handleSaveDiscChanges,
  handleAddResponsavel,
  handleRemoveResponsavel,
}: ProjetoDetailTabsProps) {
  // ---- Local UI state for disciplinas tab ----
  const [expandedDiscIdx, setExpandedDiscIdx] = useState<number | null>(null);
  const [updatingDisc, setUpdatingDisc] = useState<number | null>(null);
  const [isAddingDisc, setIsAddingDisc] = useState(false);
  const [newDisc, setNewDisc] = useState({ disciplina: "", responsavel_id: "" });
  const [addingResponsavelToDisc, setAddingResponsavelToDisc] = useState<number | null>(null);
  const [newResp, setNewResp] = useState({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" });

  // ---- Disciplina edit dialog state ----
  const [isDiscDialogOpen, setIsDiscDialogOpen] = useState(false);
  const [editingDiscIdx, setEditingDiscIdx] = useState<number | null>(null);
  const [editingDiscLocal, setEditingDiscLocal] = useState<ProjetoDisciplinaDB | null>(null);
  const [newObservation, setNewObservation] = useState("");

  // ---- Justificativa dialog state ----
  const [justificativaDialog, setJustificativaDialog] = useState<{ discIdx: number; newStatus: string } | null>(null);
  const [justificativaText, setJustificativaText] = useState("");

  // ---- Handlers ----
  const handleDiscStatusChange = async (idx: number, newStatus: string) => {
    const disc = disciplinasLegacy[idx];
    if (isDiscAtrasada(disc) && newStatus !== "Concluído" && !disc.justificativa_atraso) {
      setJustificativaDialog({ discIdx: idx, newStatus });
      setJustificativaText("");
      return;
    }
    setUpdatingDisc(idx);
    await applyDiscStatusChange(idx, newStatus);
    setUpdatingDisc(null);
  };

  const handleJustificativaConfirm = async () => {
    if (!justificativaDialog || !justificativaText.trim()) return;
    setUpdatingDisc(justificativaDialog.discIdx);
    await applyDiscStatusChange(justificativaDialog.discIdx, justificativaDialog.newStatus, justificativaText.trim());
    setUpdatingDisc(null);
    setJustificativaDialog(null);
    setJustificativaText("");
  };

  const handleDiscFieldUpdate = (field: string, value: string) => {
    if (!editingDiscLocal) return;
    const fieldMap: Record<string, string> = {
      disciplina: "nome",
      data_previsao: "data_fim",
      data_final: "data_fim_real",
    };
    const dbField = fieldMap[field] || field;
    setEditingDiscLocal((prev) => (prev ? { ...prev, [dbField]: value } : prev));
  };

  const handleAddObservation = () => {
    if (!newObservation.trim() || !editingDiscLocal) return;
    const existing = editingDiscLocal.observacoes || "";
    const timestamp = new Date().toLocaleString();
    const entry = `[${timestamp}] ${newObservation.trim()}`;
    setEditingDiscLocal((prev) => (prev ? { ...prev, observacoes: existing ? `${existing}\n${entry}` : entry } : prev));
    setNewObservation("");
  };

  const onSaveDiscChanges = async () => {
    if (!editingDiscLocal) return;
    await handleSaveDiscChanges(editingDiscLocal);
    setIsDiscDialogOpen(false);
    setEditingDiscIdx(null);
    setEditingDiscLocal(null);
    setNewObservation("");
  };

  const onAddDisc = async () => {
    await handleAddDisc(newDisc);
    setNewDisc({ disciplina: "", responsavel_id: "" });
    setIsAddingDisc(false);
  };

  const onAddResponsavel = async (discIdx: number) => {
    await handleAddResponsavel(discIdx, newResp.responsavel_id);
    setNewResp({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" });
    setAddingResponsavelToDisc(null);
  };

  const handleUpdateResponsavelDatas = async (_discIdx: number, _respIdx: number, _field: string, _value: string) => {
    // Backlog (2026-04-23): per-responsavel dates exigem migração da tabela projeto_disciplina_responsaveis.
  };

  const handleSaveResponsavelDatas = async () => {
    // Backlog (2026-04-23): mesma migração do handleUpdateResponsavelDatas.
  };

  const VALID_TABS = [
    "disciplinas",
    "cronograma",
    "pagamentos",
    "escopo",
    "orcamento",
    "marcos",
    "entregaveis",
    "burn-rate",
  ];
  const location = useLocation();
  const navigate = useNavigate();
  const initialTab = (() => {
    const h = location.hash.replace("#", "");
    return VALID_TABS.includes(h) ? h : "disciplinas";
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const h = location.hash.replace("#", "");
    if (VALID_TABS.includes(h) && h !== activeTab) setActiveTab(h);
  }, [location.hash]);

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    navigate(`#${v}`, { replace: true });
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="disciplinas">Disciplinas</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="escopo">Escopo & Aditivos</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="marcos">Marcos</TabsTrigger>
          <TabsTrigger value="entregaveis">Entregáveis</TabsTrigger>
          <TabsTrigger value="burn-rate">Burn Rate</TabsTrigger>
        </TabsList>

        <TabsContent value="disciplinas">
          <Card>
            <CardContent className="p-4">
              {canEdit && !isAddingDisc && (
                <div className="flex justify-end mb-4">
                  <Button size="sm" variant="outline" onClick={() => setIsAddingDisc(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Disciplina
                  </Button>
                </div>
              )}

              {isAddingDisc && canEdit && (
                <div className="mb-4 p-4 border-2 border-dashed border-primary/20 rounded-lg bg-primary/5 space-y-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova Disciplina</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Disciplina</Label>
                      <Select
                        value={newDisc.disciplina}
                        onValueChange={(v) => setNewDisc((p) => ({ ...p, disciplina: v }))}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Selecione a disciplina" />
                        </SelectTrigger>
                        <SelectContent>
                          {disciplinasCatalog.map((d) => (
                            <SelectItem key={d.id} value={d.nome} className="text-xs">
                              {d.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Responsável</Label>
                      <Select
                        value={newDisc.responsavel_id}
                        onValueChange={(v) => setNewDisc((p) => ({ ...p, responsavel_id: v }))}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {pessoas.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        size="sm"
                        className="h-9 flex-1"
                        onClick={onAddDisc}
                        disabled={!newDisc.disciplina || !newDisc.responsavel_id}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9"
                        onClick={() => {
                          setIsAddingDisc(false);
                          setNewDisc({ disciplina: "", responsavel_id: "" });
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {disciplinasLegacy.length === 0 && !isAddingDisc ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Layers className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhuma disciplina definida</p>
                  <p className="text-xs mt-1">Adicione disciplinas para acompanhar o progresso do projeto</p>
                  {canEdit && (
                    <Button size="sm" variant="outline" className="mt-4" onClick={() => setIsAddingDisc(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Disciplina
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {disciplinasLegacy.map((d, i) => {
                    const dpc = d.prioridade ? PROJECT_PRIORITY_CONFIG[d.prioridade as ProjectPriority] : null;
                    const DISC_STATUS_COLORS: Record<string, string> = {
                      Concluído: "bg-green-50 text-green-800 border-green-200",
                      "Em Andamento": "bg-blue-50 text-blue-800 border-blue-200",
                      Pendente: "bg-amber-50 text-amber-800 border-amber-200",
                      "Não Iniciado": "bg-gray-50 text-gray-600 border-gray-200",
                    };
                    const statusColor =
                      DISC_STATUS_COLORS[d.status || "Não Iniciado"] || DISC_STATUS_COLORS["Não Iniciado"];
                    const resps = getResponsaveisList(d);
                    const isExpanded = expandedDiscIdx === i;
                    const atrasada = isDiscAtrasada(d);

                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-lg border transition-all group",
                          dpc ? `border-l-4 ${dpc.borderColor}` : "border-l-4 border-l-gray-200",
                          atrasada && "bg-red-50/30",
                          isExpanded && "shadow-sm ring-1 ring-black/5"
                        )}
                      >
                        {/* Header */}
                        <div
                          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedDiscIdx(isExpanded ? null : i)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{d.disciplina}</span>
                              {dpc && (
                                <span
                                  className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-full font-medium",
                                    dpc.bgColor,
                                    dpc.color
                                  )}
                                >
                                  {dpc.label}
                                </span>
                              )}
                              {atrasada && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                                  <AlertTriangle size={10} /> Atrasada
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {resps.map((r) => r.responsavel_nome).join(", ") || "Sem responsável"}
                              </span>
                              {d.data_previsao && (
                                <>
                                  <span className="text-muted-foreground/30">·</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Prev: {formatDateShort(d.data_previsao)}
                                  </span>
                                </>
                              )}
                              {resps.length > 1 && (
                                <>
                                  <span className="text-muted-foreground/30">·</span>
                                  <span>{resps.length} responsáveis</span>
                                </>
                              )}
                            </div>
                            {atrasada && d.justificativa_atraso && (
                              <p className="text-[11px] text-red-600 mt-1 italic">
                                Justificativa: {d.justificativa_atraso}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {canEdit && (
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setEditingDiscIdx(i);
                                    const dbD = getDbDisc(i);
                                    if (dbD) setEditingDiscLocal({ ...dbD });
                                    setIsDiscDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                  onClick={() => handleRemoveDisc(i)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                            {canEdit ? (
                              <Select
                                value={d.status || "Não Iniciado"}
                                onValueChange={(val) => handleDiscStatusChange(i, val)}
                                disabled={updatingDisc === i}
                              >
                                <SelectTrigger className={cn("h-8 w-[140px] text-xs border rounded-full", statusColor)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {disciplinaStatusOptions.map((s) => (
                                    <SelectItem key={s} value={s} className="text-xs">
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={d.status === "Concluído" ? "default" : "secondary"} className="text-xs">
                                {d.status || "Não iniciado"}
                              </Badge>
                            )}
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </div>
                        </div>

                        {/* Painel expandido */}
                        {isExpanded && (
                          <div className="border-t bg-muted/10">
                            <div className="p-4 space-y-3">
                              {resps.map((resp, rIdx) => (
                                <div key={rIdx} className="flex items-start gap-3 p-3 rounded-lg bg-white border">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <User className="h-4 w-4 text-primary/70" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{resp.responsavel_nome}</span>
                                      {resp.status && resp.status !== d.status && (
                                        <Badge variant="outline" className="text-[10px] h-5">
                                          {resp.status}
                                        </Badge>
                                      )}
                                    </div>
                                    {canEdit ? (
                                      <div className="grid grid-cols-3 gap-2 mt-2">
                                        <div className="space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">Início</Label>
                                          <Input
                                            type="date"
                                            className="h-8 text-xs"
                                            value={resp.data_inicio || ""}
                                            onChange={(e) =>
                                              handleUpdateResponsavelDatas(i, rIdx, "data_inicio", e.target.value)
                                            }
                                            onBlur={handleSaveResponsavelDatas}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">Previsão</Label>
                                          <Input
                                            type="date"
                                            className="h-8 text-xs"
                                            value={resp.data_previsao || ""}
                                            onChange={(e) =>
                                              handleUpdateResponsavelDatas(i, rIdx, "data_previsao", e.target.value)
                                            }
                                            onBlur={handleSaveResponsavelDatas}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">Final</Label>
                                          <Input
                                            type="date"
                                            className="h-8 text-xs"
                                            value={resp.data_final || ""}
                                            onChange={(e) =>
                                              handleUpdateResponsavelDatas(i, rIdx, "data_final", e.target.value)
                                            }
                                            onBlur={handleSaveResponsavelDatas}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                        {resp.data_inicio && <span>Início: {formatDateShort(resp.data_inicio)}</span>}
                                        {resp.data_previsao && (
                                          <span>Previsão: {formatDateShort(resp.data_previsao)}</span>
                                        )}
                                        {resp.data_final && (
                                          <span className="text-green-700 font-medium">
                                            Final: {formatDateShort(resp.data_final)}
                                          </span>
                                        )}
                                        {!resp.data_inicio && !resp.data_previsao && !resp.data_final && (
                                          <span>Sem datas definidas</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {canEdit && resps.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-red-600 flex-shrink-0"
                                      onClick={() => handleRemoveResponsavel(i, rIdx)}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Adicionar responsável */}
                            {canEdit && (
                              <div className="px-4 pb-4">
                                {addingResponsavelToDisc === i ? (
                                  <div className="p-3 rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 space-y-3">
                                    <Select
                                      value={newResp.responsavel_id}
                                      onValueChange={(v) => setNewResp((prev) => ({ ...prev, responsavel_id: v }))}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Selecione o responsável" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {pessoas.map((p) => (
                                          <SelectItem key={p.id} value={p.id} className="text-xs">
                                            {p.nome}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Início</Label>
                                        <Input
                                          type="date"
                                          className="h-8 text-xs"
                                          value={newResp.data_inicio}
                                          onChange={(e) =>
                                            setNewResp((prev) => ({
                                              ...prev,
                                              data_inicio: e.target.value,
                                            }))
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Previsão</Label>
                                        <Input
                                          type="date"
                                          className="h-8 text-xs"
                                          value={newResp.data_previsao}
                                          onChange={(e) =>
                                            setNewResp((prev) => ({
                                              ...prev,
                                              data_previsao: e.target.value,
                                            }))
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Final</Label>
                                        <Input
                                          type="date"
                                          className="h-8 text-xs"
                                          value={newResp.data_final}
                                          onChange={(e) =>
                                            setNewResp((prev) => ({
                                              ...prev,
                                              data_final: e.target.value,
                                            }))
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => onAddResponsavel(i)}
                                      >
                                        Adicionar
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => {
                                          setAddingResponsavelToDisc(null);
                                          setNewResp({
                                            responsavel_id: "",
                                            data_inicio: "",
                                            data_previsao: "",
                                            data_final: "",
                                          });
                                        }}
                                      >
                                        Cancelar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs w-full border-dashed"
                                    onClick={() => setAddingResponsavelToDisc(i)}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar responsável
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dialog de edição de disciplina */}
          <Dialog
            open={isDiscDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setIsDiscDialogOpen(false);
                setEditingDiscIdx(null);
                setEditingDiscLocal(null);
                setNewObservation("");
              }
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-muted-foreground" />
                  Editar Disciplina
                </DialogTitle>
                <DialogDescription>
                  Altere os dados da disciplina. As mudanças são salvas ao clicar em Salvar.
                </DialogDescription>
              </DialogHeader>

              {editingDiscLocal && (
                <div className="space-y-5 mt-2">
                  {/* Seção: Dados básicos */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados Básicos</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Disciplina</Label>
                        <Select
                          value={editingDiscLocal.nome}
                          onValueChange={(val) => handleDiscFieldUpdate("disciplina", val)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {disciplinasCatalog.map((d) => (
                              <SelectItem key={d.id} value={d.nome}>
                                {d.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Prioridade</Label>
                        <Select
                          value={editingDiscLocal.prioridade || PROJECT_PRIORITY.MEDIA}
                          onValueChange={(val) => handleDiscFieldUpdate("prioridade", val)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((p) => (
                              <SelectItem key={p} value={p}>
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "h-2 w-2 rounded-full",
                                      p === PROJECT_PRIORITY.ALTA
                                        ? "bg-red-500"
                                        : p === PROJECT_PRIORITY.MEDIA
                                          ? "bg-amber-400"
                                          : "bg-blue-400"
                                    )}
                                  />
                                  {PROJECT_PRIORITY_CONFIG[p].label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={editingDiscLocal.status || "Não Iniciado"}
                        onValueChange={(val) => handleDiscFieldUpdate("status", val)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {disciplinaStatusOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Seção: Datas */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cronograma</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Início</Label>
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          value={editingDiscLocal.data_inicio || ""}
                          onChange={(e) => handleDiscFieldUpdate("data_inicio", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Previsão</Label>
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          value={editingDiscLocal.data_fim || ""}
                          onChange={(e) => handleDiscFieldUpdate("data_previsao", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Final</Label>
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          value={editingDiscLocal.data_fim_real || ""}
                          onChange={(e) => handleDiscFieldUpdate("data_final", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Observações */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <MessageSquare size={12} /> Observações
                    </p>

                    <div className="rounded-lg border max-h-48 overflow-y-auto">
                      {!editingDiscLocal.observacoes ? (
                        <p className="text-xs text-center text-muted-foreground py-6">Nenhuma observação registrada</p>
                      ) : (
                        <div className="px-3 py-2.5">
                          <p className="text-sm text-foreground whitespace-pre-line">{editingDiscLocal.observacoes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Escreva uma observação..."
                        value={newObservation}
                        onChange={(e) => setNewObservation(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddObservation();
                          }
                        }}
                        className="h-9"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9"
                        onClick={handleAddObservation}
                        disabled={!newObservation.trim()}
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setIsDiscDialogOpen(false);
                        setEditingDiscIdx(null);
                        setNewObservation("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button className="flex-1" onClick={onSaveDiscChanges}>
                      Salvar Alterações
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="cronograma">
          <CronogramaTab
            disciplinas={disciplinasLegacy}
            projetoDataInicio={projeto.data_inicio}
            projetoDataPrevisao={projeto.data_previsao}
          />
        </TabsContent>

        <TabsContent value="pagamentos">
          <PagamentosTab projetoId={projeto.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="orcamento">
          <ProjectBudgetTab projetoId={projeto.id} canEdit={canEdit} disciplinas={disciplinasLegacy} />
        </TabsContent>

        <TabsContent value="marcos">
          <BillingMilestonesTab projetoId={projeto.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="escopo">
          <EscopoTab projetoId={projeto.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="entregaveis">
          <EntregaveisTab
            projetoId={projeto.id}
            canEdit={canEdit}
            disciplinas={disciplinasLegacy.map((d) => ({ disciplina: d.disciplina }))}
          />
        </TabsContent>

        <TabsContent value="burn-rate">
          <BurnRateChart projetoId={projeto.id} />
        </TabsContent>
      </Tabs>

      {/* Dialog de justificativa obrigatória para atraso */}
      <AlertDialog
        open={!!justificativaDialog}
        onOpenChange={(open) => {
          if (!open) {
            setJustificativaDialog(null);
            setJustificativaText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Justificativa de Atraso Obrigatória
            </AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina{" "}
              <strong>
                {justificativaDialog !== null && disciplinasLegacy[justificativaDialog.discIdx]?.disciplina}
              </strong>{" "}
              está atrasada. É necessário informar uma justificativa para continuar.
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

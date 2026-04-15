import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft,
  User,
  DollarSign,
  Calendar,
  Ruler,
  Loader2,
  Edit,
  Plus,
  Trash2,
  MessageSquare,
  ChevronDown,
  Layers,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import {
  PROJECT_STATUS_CONFIG,
  PROJECT_PRIORITY,
  PROJECT_PRIORITY_CONFIG,
  PRIORITY_OPTIONS,
  type ProjectPriority,
} from "@/constants";
import {
  type Projeto,
  type DisciplinaResponsavel,
  type DisciplinaObservacao,
  type ResponsavelDatas,
  disciplinaStatusOptions,
  formatCurrency,
  formatDate,
  formatDateShort,
  getDeadlineStatus,
  getProjectProgress,
  getResponsaveisList,
  isDiscAtrasada,
} from "./types";
import { Textarea } from "@/components/ui/textarea";
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
import { AlertTriangle } from "lucide-react";
import { ProjectBudgetTab } from "./components/ProjectBudgetTab";
import { BillingMilestonesTab } from "./components/BillingMilestonesTab";
import { PagamentosTab } from "./components/PagamentosTab";
import { EscopoTab } from "./components/EscopoTab";
import { BurnRateChart } from "./components/BurnRateChart";
import { CronogramaTab } from "./components/CronogramaTab";
import { ProjetoFormDialog } from "./components/ProjetoFormDialog";
import { useProjetoRentabilidade } from "@/hooks/useRentabilidade";
import { useTemplates } from "@/hooks/useTemplates";

export default function ProjetoDetail() {
  const { id } = useParams<{ id: string }>();
  usePageTitle("Projeto");
  const navigate = useNavigate();
  const { data: userRole } = useUserRole();
  const canEdit = userRole === "admin" || userRole === "operacional";

  const { toast } = useToast();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: rentabilidade } = useProjetoRentabilidade(id);

  const [disciplinasCatalog, setDisciplinasCatalog] = useState<{ id: string; nome: string }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [editingDiscIdx, setEditingDiscIdx] = useState<number | null>(null);
  const [isDiscDialogOpen, setIsDiscDialogOpen] = useState(false);
  const [newObservation, setNewObservation] = useState("");
  const [updatingDisc, setUpdatingDisc] = useState<number | null>(null);
  const [isAddingDisc, setIsAddingDisc] = useState(false);
  const [newDisc, setNewDisc] = useState({ disciplina: "", responsavel_id: "" });
  const [expandedDiscIdx, setExpandedDiscIdx] = useState<number | null>(null);
  const [addingResponsavelToDisc, setAddingResponsavelToDisc] = useState<number | null>(null);
  const [newResp, setNewResp] = useState({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" });
  const [justificativaDialog, setJustificativaDialog] = useState<{ discIdx: number; newStatus: string } | null>(null);
  const [justificativaText, setJustificativaText] = useState("");

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const { data: templatesData = [] } = useTemplates();

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const { data, error } = await supabase.from("projetos").select("*, clientes(nome)").eq("id", id).single();

      if (error || !data) {
        navigate("/projetos");
        return;
      }

      setProjeto({
        id: data.id,
        codigo_projeto: data.codigo_projeto,
        nome: data.nome,
        cliente_id: data.cliente_id,
        cliente_nome: (data as unknown as { clientes?: { nome?: string } }).clientes?.nome,
        localizacao: data.localizacao || undefined,
        parcelas: data.parcelas || undefined,
        area_m2: data.area_m2 || undefined,
        data_inicio: data.data_inicio,
        data_previsao: data.data_previsao,
        data_final: data.data_final || undefined,
        status: data.status as Projeto["status"],
        prioridade: (data.prioridade as ProjectPriority) || PROJECT_PRIORITY.MEDIA,
        valor_contrato: data.valor_contrato,
        observacao: data.observacao,
        disciplinas: Array.isArray(data.disciplinas) ? data.disciplinas : [],
      });
      setLoading(false);
    };
    fetch();
  }, [id, navigate]);

  useEffect(() => {
    if (!canEdit) return;
    Promise.all([
      supabase.from("disciplinas").select("id, nome").order("nome"),
      supabase.from("pessoas").select("id, nome").order("nome"),
      supabase.from("clientes").select("id, nome").order("nome"),
      supabase.auth.getUser(),
    ]).then(([discRes, pesRes, cliRes, userRes]) => {
      if (discRes.data) setDisciplinasCatalog(discRes.data);
      if (pesRes.data) setPessoas(pesRes.data);
      if (cliRes.data) setClientes(cliRes.data);
      const user = userRes.data.user;
      if (user) {
        setCurrentUser({
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
          email: user.email || "",
        });
      }
    });
  }, [canEdit]);

  const saveDisciplinas = async (newDiscs: DisciplinaResponsavel[]) => {
    if (!projeto) return false;
    const { error } = await supabase.from("projetos").update({ disciplinas: newDiscs }).eq("id", projeto.id);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
      return false;
    }
    setProjeto((prev) => (prev ? { ...prev, disciplinas: newDiscs } : prev));
    return true;
  };

  const handleDiscStatusChange = async (idx: number, newStatus: string) => {
    if (!projeto) return;
    const disc = projeto.disciplinas[idx];
    // Se a disciplina está atrasada e o novo status NÃO é "Concluído", exigir justificativa
    if (isDiscAtrasada(disc) && newStatus !== "Concluído" && !disc.justificativa_atraso) {
      setJustificativaDialog({ discIdx: idx, newStatus });
      setJustificativaText("");
      return;
    }
    await applyDiscStatusChange(idx, newStatus);
  };

  const applyDiscStatusChange = async (idx: number, newStatus: string, justificativa?: string) => {
    if (!projeto) return;
    setUpdatingDisc(idx);
    const updated = [...projeto.disciplinas];
    updated[idx] = {
      ...updated[idx],
      status: newStatus,
      ...(newStatus === "Concluído" && !updated[idx].data_final
        ? { data_final: new Date().toISOString().split("T")[0] }
        : {}),
      ...(justificativa !== undefined ? { justificativa_atraso: justificativa } : {}),
    };
    const ok = await saveDisciplinas(updated);
    if (ok) toast({ title: `${updated[idx].disciplina}: ${newStatus}` });
    setUpdatingDisc(null);
  };

  const handleJustificativaConfirm = async () => {
    if (!justificativaDialog || !justificativaText.trim()) return;
    await applyDiscStatusChange(justificativaDialog.discIdx, justificativaDialog.newStatus, justificativaText.trim());
    setJustificativaDialog(null);
    setJustificativaText("");
  };

  const handleDiscFieldUpdate = (field: keyof DisciplinaResponsavel, value: string) => {
    if (editingDiscIdx === null || !projeto) return;
    const updated = [...projeto.disciplinas];
    if (field === "responsavel_id") {
      const pessoa = pessoas.find((p) => p.id === value);
      updated[editingDiscIdx] = {
        ...updated[editingDiscIdx],
        responsavel_id: value,
        responsavel_nome: pessoa?.nome || "",
      };
    } else {
      updated[editingDiscIdx] = { ...updated[editingDiscIdx], [field]: value };
    }
    setProjeto((prev) => (prev ? { ...prev, disciplinas: updated } : prev));
  };

  const handleAddObservation = () => {
    if (!newObservation.trim() || editingDiscIdx === null || !projeto) return;
    const updated = [...projeto.disciplinas];
    const disc = updated[editingDiscIdx];
    const newObs: DisciplinaObservacao = {
      id: crypto.randomUUID(),
      texto: newObservation,
      usuario: "Usuário",
      data: new Date().toISOString(),
    };
    updated[editingDiscIdx] = {
      ...disc,
      observacoes: [...(disc.observacoes || []), newObs],
    };
    setProjeto((prev) => (prev ? { ...prev, disciplinas: updated } : prev));
    setNewObservation("");
  };

  const handleSaveDiscChanges = async () => {
    if (!projeto) return;
    const ok = await saveDisciplinas(projeto.disciplinas);
    if (ok) {
      toast({ title: "Disciplina atualizada" });
      setIsDiscDialogOpen(false);
      setEditingDiscIdx(null);
      setNewObservation("");
    }
  };

  const handleRemoveDisc = async (idx: number) => {
    if (!projeto) return;
    const updated = projeto.disciplinas.filter((_, i) => i !== idx);
    const ok = await saveDisciplinas(updated);
    if (ok) toast({ title: "Disciplina removida" });
  };

  const handleAddDisc = async () => {
    if (!projeto || !newDisc.disciplina || !newDisc.responsavel_id) return;
    const pessoa = pessoas.find((p) => p.id === newDisc.responsavel_id);
    const nova: DisciplinaResponsavel = {
      disciplina: newDisc.disciplina,
      responsavel_id: newDisc.responsavel_id,
      responsavel_nome: pessoa?.nome || "",
      status: "Não Iniciado",
      observacoes: [],
      responsaveis: [
        {
          responsavel_id: newDisc.responsavel_id,
          responsavel_nome: pessoa?.nome || "",
          status: "Não Iniciado",
        },
      ],
    };
    const updated = [...projeto.disciplinas, nova];
    const ok = await saveDisciplinas(updated);
    if (ok) {
      toast({ title: "Disciplina adicionada" });
      setNewDisc({ disciplina: "", responsavel_id: "" });
      setIsAddingDisc(false);
    }
  };

  const handleAddResponsavel = async (discIdx: number) => {
    if (!projeto || !newResp.responsavel_id) return;
    const pessoa = pessoas.find((p) => p.id === newResp.responsavel_id);
    const updated = [...projeto.disciplinas];
    const disc = updated[discIdx];
    const currentResps = getResponsaveisList(disc);

    if (currentResps.some((r) => r.responsavel_id === newResp.responsavel_id)) {
      toast({ variant: "destructive", title: "Responsável já adicionado nesta disciplina" });
      return;
    }

    const novoResp: ResponsavelDatas = {
      responsavel_id: newResp.responsavel_id,
      responsavel_nome: pessoa?.nome || "",
      data_inicio: newResp.data_inicio || undefined,
      data_previsao: newResp.data_previsao || undefined,
      data_final: newResp.data_final || undefined,
      status: "Não Iniciado",
    };

    updated[discIdx] = {
      ...disc,
      responsaveis: [...currentResps, novoResp],
    };

    const ok = await saveDisciplinas(updated);
    if (ok) {
      toast({ title: `${pessoa?.nome} adicionado(a) a ${disc.disciplina}` });
      setNewResp({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" });
      setAddingResponsavelToDisc(null);
    }
  };

  const handleRemoveResponsavel = async (discIdx: number, respIdx: number) => {
    if (!projeto) return;
    const updated = [...projeto.disciplinas];
    const disc = updated[discIdx];
    const resps = getResponsaveisList(disc);

    if (resps.length <= 1) {
      toast({ variant: "destructive", title: "A disciplina precisa ter ao menos um responsável" });
      return;
    }

    const newResps = resps.filter((_, i) => i !== respIdx);
    updated[discIdx] = {
      ...disc,
      responsaveis: newResps,
      responsavel_id: newResps[0].responsavel_id,
      responsavel_nome: newResps[0].responsavel_nome,
    };

    const ok = await saveDisciplinas(updated);
    if (ok) toast({ title: "Responsável removido" });
  };

  const handleUpdateResponsavelDatas = async (
    discIdx: number,
    respIdx: number,
    field: keyof ResponsavelDatas,
    value: string
  ) => {
    if (!projeto) return;
    const updated = [...projeto.disciplinas];
    const disc = updated[discIdx];
    const resps = [...getResponsaveisList(disc)];

    resps[respIdx] = { ...resps[respIdx], [field]: value };
    updated[discIdx] = { ...disc, responsaveis: resps };
    setProjeto((prev) => (prev ? { ...prev, disciplinas: updated } : prev));
  };

  const handleSaveResponsavelDatas = async () => {
    if (!projeto) return;
    const ok = await saveDisciplinas(projeto.disciplinas);
    if (ok) toast({ title: "Datas atualizadas" });
  };

  if (loading || !projeto) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  const deadline = getDeadlineStatus(projeto);
  const progress = getProjectProgress(projeto.disciplinas);

  const margemBrutaPct = rentabilidade?.margem_bruta_pct ?? null;

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/projetos")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{projeto.codigo_projeto}</h1>
            <Badge className={PROJECT_STATUS_CONFIG[projeto.status]?.color}>
              {PROJECT_STATUS_CONFIG[projeto.status]?.label}
            </Badge>
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
          <p className="text-sm text-muted-foreground">{projeto.nome}</p>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Editar Projeto
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <User className="h-3 w-3" />
              Cliente
            </div>
            <p className="text-sm font-medium truncate">{projeto.cliente_nome || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              Contrato
            </div>
            <p className="text-sm font-medium">{formatCurrency(projeto.valor_contrato)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Ruler className="h-3 w-3" />
              Área
            </div>
            <p className="text-sm font-medium">{projeto.area_m2 || 0} m²</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              Prazo
            </div>
            <p className="text-sm font-medium">{formatDate(projeto.data_previsao)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Margem Bruta</div>
            <p
              className={`text-sm font-bold ${margemBrutaPct !== null ? (margemBrutaPct >= 20 ? "text-green-600" : margemBrutaPct >= 0 ? "text-yellow-600" : "text-red-600") : ""}`}
            >
              {margemBrutaPct !== null ? `${margemBrutaPct.toFixed(1)}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Progresso das disciplinas</span>
          <span className="text-xs font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="disciplinas" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="disciplinas">Disciplinas</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="orcamento" disabled className="cursor-not-allowed opacity-40">
            Orçamento
          </TabsTrigger>
          <TabsTrigger value="marcos" disabled className="cursor-not-allowed opacity-40">
            Marcos
          </TabsTrigger>
          <TabsTrigger value="escopo" disabled className="cursor-not-allowed opacity-40">
            Escopo & Aditivos
          </TabsTrigger>
          <TabsTrigger value="burn-rate" disabled className="cursor-not-allowed opacity-40">
            Burn Rate
          </TabsTrigger>
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
                        onClick={handleAddDisc}
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

              {projeto.disciplinas.length === 0 && !isAddingDisc ? (
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
                  {projeto.disciplinas.map((d, i) => {
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
                                        onClick={() => handleAddResponsavel(i)}
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

              {editingDiscIdx !== null && projeto.disciplinas[editingDiscIdx] && (
                <div className="space-y-5 mt-2">
                  {/* Seção: Dados básicos */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados Básicos</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Disciplina</Label>
                        <Select
                          value={projeto.disciplinas[editingDiscIdx].disciplina}
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
                          value={projeto.disciplinas[editingDiscIdx].prioridade || PROJECT_PRIORITY.MEDIA}
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
                        value={projeto.disciplinas[editingDiscIdx].status || "Não Iniciado"}
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
                          value={projeto.disciplinas[editingDiscIdx].data_inicio || ""}
                          onChange={(e) => handleDiscFieldUpdate("data_inicio", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Previsão</Label>
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          value={projeto.disciplinas[editingDiscIdx].data_previsao || ""}
                          onChange={(e) => handleDiscFieldUpdate("data_previsao", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Final</Label>
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          value={projeto.disciplinas[editingDiscIdx].data_final || ""}
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
                      {!projeto.disciplinas[editingDiscIdx].observacoes ||
                      projeto.disciplinas[editingDiscIdx].observacoes!.length === 0 ? (
                        <p className="text-xs text-center text-muted-foreground py-6">Nenhuma observação registrada</p>
                      ) : (
                        <div className="divide-y">
                          {projeto.disciplinas[editingDiscIdx].observacoes!.map((obs, oi) => (
                            <div key={oi} className="px-3 py-2.5">
                              <p className="text-sm text-foreground">{obs.texto}</p>
                              <div className="flex justify-between items-center mt-1.5 text-[10px] text-muted-foreground">
                                <span className="font-medium">{obs.usuario}</span>
                                <span>{new Date(obs.data).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
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
                    <Button className="flex-1" onClick={handleSaveDiscChanges}>
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
            disciplinas={projeto.disciplinas}
            projetoDataInicio={projeto.data_inicio}
            projetoDataPrevisao={projeto.data_previsao}
          />
        </TabsContent>

        <TabsContent value="pagamentos">
          <PagamentosTab projetoId={projeto.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="orcamento">
          <ProjectBudgetTab projetoId={projeto.id} canEdit={canEdit} disciplinas={projeto.disciplinas} />
        </TabsContent>

        <TabsContent value="marcos">
          <BillingMilestonesTab projetoId={projeto.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="escopo">
          <EscopoTab projetoId={projeto.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="burn-rate">
          <BurnRateChart projetoId={projeto.id} />
        </TabsContent>
      </Tabs>

      <ProjetoFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        editProjeto={projeto}
        clientes={clientes}
        pessoas={pessoas}
        disciplinas={disciplinasCatalog}
        templatesData={templatesData}
        currentUser={currentUser}
        onSaved={async () => {
          const { data } = await supabase.from("projetos").select("*, clientes(nome)").eq("id", projeto.id).single();
          if (data) {
            setProjeto({
              id: data.id,
              codigo_projeto: data.codigo_projeto,
              nome: data.nome,
              cliente_id: data.cliente_id,
              cliente_nome: (data as unknown as { clientes?: { nome?: string } }).clientes?.nome,
              localizacao: data.localizacao || undefined,
              parcelas: data.parcelas || undefined,
              area_m2: data.area_m2 || undefined,
              data_inicio: data.data_inicio,
              data_previsao: data.data_previsao,
              data_final: data.data_final || undefined,
              status: data.status as Projeto["status"],
              prioridade: (data.prioridade as ProjectPriority) || PROJECT_PRIORITY.MEDIA,
              valor_contrato: data.valor_contrato,
              observacao: data.observacao,
              disciplinas: Array.isArray(data.disciplinas) ? data.disciplinas : [],
            });
          }
        }}
      />

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
                {justificativaDialog !== null && projeto?.disciplinas[justificativaDialog.discIdx]?.disciplina}
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
    </PageLayout>
  );
}

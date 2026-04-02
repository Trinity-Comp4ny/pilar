import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, User, DollarSign, Calendar, Ruler, MapPin, Loader2, Edit, Plus, Trash2, MessageSquare, ChevronDown } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { PROJECT_STATUS_CONFIG, PROJECT_PRIORITY, PROJECT_PRIORITY_CONFIG, PRIORITY_OPTIONS, type ProjectPriority } from "@/constants";
import { type Projeto, type DisciplinaResponsavel, type DisciplinaObservacao, type ResponsavelDatas, disciplinaStatusOptions, formatCurrency, formatDate, formatDateShort, getDeadlineStatus, getProjectProgress, getResponsaveisList } from "./types";
import { ProjectBudgetTab } from "./components/ProjectBudgetTab";
import { BillingMilestonesTab } from "./components/BillingMilestonesTab";
import { EscopoTab } from "./components/EscopoTab";
import { useProjetoRentabilidade } from "@/hooks/useRentabilidade";

export default function ProjetoDetail() {
  const { id } = useParams<{ id: string }>();
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

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*, clientes(nome)")
        .eq("id", id)
        .single();

      if (error || !data) {
        navigate("/projetos");
        return;
      }

      setProjeto({
        id: data.id,
        codigo_projeto: data.codigo_projeto,
        nome: data.nome,
        cliente_id: data.cliente_id,
        cliente_nome: (data as any).clientes?.nome,
        localizacao: data.localizacao || undefined,
        parcelas: data.parcelas || undefined,
        area_m2: data.area_m2 || undefined,
        data_inicio: data.data_inicio,
        data_previsao: data.data_previsao,
        data_final: data.data_final || undefined,
        status: data.status as Projeto["status"],
        prioridade: ((data as any).prioridade as ProjectPriority) || PROJECT_PRIORITY.MEDIA,
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
    ]).then(([discRes, pesRes]) => {
      if (discRes.data) setDisciplinasCatalog(discRes.data);
      if (pesRes.data) setPessoas(pesRes.data);
    });
  }, [canEdit]);

  const saveDisciplinas = async (newDiscs: DisciplinaResponsavel[]) => {
    if (!projeto) return false;
    const { error } = await supabase
      .from("projetos")
      .update({ disciplinas: newDiscs })
      .eq("id", projeto.id);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
      return false;
    }
    setProjeto((prev) => (prev ? { ...prev, disciplinas: newDiscs } : prev));
    return true;
  };

  const handleDiscStatusChange = async (idx: number, newStatus: string) => {
    if (!projeto) return;
    setUpdatingDisc(idx);
    const updated = [...projeto.disciplinas];
    updated[idx] = {
      ...updated[idx],
      status: newStatus,
      ...(newStatus === "Concluído" && !updated[idx].data_final
        ? { data_final: new Date().toISOString().split("T")[0] }
        : {}),
    };
    const ok = await saveDisciplinas(updated);
    if (ok) toast({ title: `${updated[idx].disciplina}: ${newStatus}` });
    setUpdatingDisc(null);
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
      responsaveis: [{
        responsavel_id: newDisc.responsavel_id,
        responsavel_nome: pessoa?.nome || "",
        status: "Não Iniciado",
      }],
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

  const handleUpdateResponsavelDatas = async (discIdx: number, respIdx: number, field: keyof ResponsavelDatas, value: string) => {
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><User className="h-3 w-3" />Cliente</div>
            <p className="text-sm font-medium truncate">{projeto.cliente_nome || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><DollarSign className="h-3 w-3" />Contrato</div>
            <p className="text-sm font-medium">{formatCurrency(projeto.valor_contrato)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Ruler className="h-3 w-3" />Área</div>
            <p className="text-sm font-medium">{projeto.area_m2 || 0} m²</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Calendar className="h-3 w-3" />Prazo</div>
            <p className="text-sm font-medium">{formatDate(projeto.data_previsao)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Margem Bruta</div>
            <p className={`text-sm font-bold ${margemBrutaPct !== null ? (margemBrutaPct >= 20 ? "text-green-600" : margemBrutaPct >= 0 ? "text-yellow-600" : "text-red-600") : ""}`}>
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
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="marcos">Marcos</TabsTrigger>
          <TabsTrigger value="escopo">Escopo & Aditivos</TabsTrigger>
        </TabsList>

        <TabsContent value="disciplinas">
          <Card>
            <CardContent className="p-4">
              {canEdit && (
                <div className="flex justify-end mb-3">
                  <Button size="sm" variant="outline" onClick={() => setIsAddingDisc(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Disciplina
                  </Button>
                </div>
              )}

              {isAddingDisc && canEdit && (
                <div className="mb-4 p-3 border rounded-lg bg-gray-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Disciplina</Label>
                      <Select value={newDisc.disciplina} onValueChange={(v) => setNewDisc((p) => ({ ...p, disciplina: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {disciplinasCatalog.map((d) => (
                            <SelectItem key={d.id} value={d.nome} className="text-xs">{d.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Responsável</Label>
                      <Select value={newDisc.responsavel_id} onValueChange={(v) => setNewDisc((p) => ({ ...p, responsavel_id: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {pessoas.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddDisc} disabled={!newDisc.disciplina || !newDisc.responsavel_id}>Adicionar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setIsAddingDisc(false); setNewDisc({ disciplina: "", responsavel_id: "" }); }}>Cancelar</Button>
                  </div>
                </div>
              )}

              {projeto.disciplinas.length === 0 && !isAddingDisc ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma disciplina definida.</p>
              ) : (
                <div className="space-y-3">
                  {projeto.disciplinas.map((d, i) => {
                    const dpc = d.prioridade ? PROJECT_PRIORITY_CONFIG[d.prioridade as ProjectPriority] : null;
                    const DISC_STATUS_COLORS: Record<string, string> = {
                      "Concluído": "bg-green-100 text-green-800 border-green-200",
                      "Em Andamento": "bg-blue-100 text-blue-800 border-blue-200",
                      "Pendente": "bg-yellow-100 text-yellow-800 border-yellow-200",
                      "Não Iniciado": "bg-gray-100 text-gray-600 border-gray-200",
                    };
                    const statusColor = DISC_STATUS_COLORS[d.status || "Não Iniciado"] || DISC_STATUS_COLORS["Não Iniciado"];
                    const resps = getResponsaveisList(d);
                    const isExpanded = expandedDiscIdx === i;

                    return (
                      <div key={i} className={`rounded-lg border ${dpc ? `border-l-[3px] ${dpc.borderColor}` : ""}`}>
                        {/* Header da disciplina - clicável para expandir */}
                        <div
                          className="flex items-center justify-between gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedDiscIdx(isExpanded ? null : i)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium">{d.disciplina}</p>
                              {dpc && (
                                <span className={`text-[9px] px-1.5 py-0 rounded-full font-medium ${dpc.bgColor} ${dpc.color}`}>
                                  {dpc.label}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground ml-1">
                                ({resps.length} {resps.length === 1 ? "responsável" : "responsáveis"})
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {resps.map((r) => r.responsavel_nome).join(", ") || "Sem responsável"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {canEdit ? (
                              <Select
                                value={d.status || "Não Iniciado"}
                                onValueChange={(val) => handleDiscStatusChange(i, val)}
                                disabled={updatingDisc === i}
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
                              <Badge variant={d.status === "Concluído" ? "default" : "secondary"} className="text-xs">
                                {d.status || "Não iniciado"}
                              </Badge>
                            )}
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </div>

                        {/* Painel expandido - responsáveis com datas */}
                        {isExpanded && (
                          <div className="border-t px-3 pb-3">
                            <div className="mt-3 space-y-2">
                              {resps.map((resp, rIdx) => (
                                <div key={rIdx} className="bg-muted/30 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-sm font-medium">{resp.responsavel_nome}</span>
                                      {resp.status && (
                                        <Badge variant="outline" className="text-[10px] h-5">{resp.status}</Badge>
                                      )}
                                    </div>
                                    {canEdit && resps.length > 1 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                        onClick={() => handleRemoveResponsavel(i, rIdx)}
                                      >
                                        <Trash2 size={12} />
                                      </Button>
                                    )}
                                  </div>

                                  {canEdit ? (
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Início</Label>
                                        <Input
                                          type="date"
                                          className="h-8 text-xs"
                                          value={resp.data_inicio || ""}
                                          onChange={(e) => handleUpdateResponsavelDatas(i, rIdx, "data_inicio", e.target.value)}
                                          onBlur={handleSaveResponsavelDatas}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Previsão</Label>
                                        <Input
                                          type="date"
                                          className="h-8 text-xs"
                                          value={resp.data_previsao || ""}
                                          onChange={(e) => handleUpdateResponsavelDatas(i, rIdx, "data_previsao", e.target.value)}
                                          onBlur={handleSaveResponsavelDatas}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Final</Label>
                                        <Input
                                          type="date"
                                          className="h-8 text-xs"
                                          value={resp.data_final || ""}
                                          onChange={(e) => handleUpdateResponsavelDatas(i, rIdx, "data_final", e.target.value)}
                                          onBlur={handleSaveResponsavelDatas}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                      {resp.data_inicio && <span>Início: {formatDateShort(resp.data_inicio)}</span>}
                                      {resp.data_previsao && <span>Previsão: {formatDateShort(resp.data_previsao)}</span>}
                                      {resp.data_final && <span className="text-green-700 font-medium">Final: {formatDateShort(resp.data_final)}</span>}
                                      {!resp.data_inicio && !resp.data_previsao && !resp.data_final && <span>Sem datas definidas</span>}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Adicionar responsável */}
                            {canEdit && (
                              <div className="mt-3">
                                {addingResponsavelToDisc === i ? (
                                  <div className="bg-muted/20 rounded-lg p-3 border border-dashed space-y-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Responsável</Label>
                                      <Select value={newResp.responsavel_id} onValueChange={(v) => setNewResp((prev) => ({ ...prev, responsavel_id: v }))}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                          {pessoas.map((p) => (
                                            <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Início</Label>
                                        <Input type="date" className="h-8 text-xs" value={newResp.data_inicio} onChange={(e) => setNewResp((prev) => ({ ...prev, data_inicio: e.target.value }))} />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Previsão</Label>
                                        <Input type="date" className="h-8 text-xs" value={newResp.data_previsao} onChange={(e) => setNewResp((prev) => ({ ...prev, data_previsao: e.target.value }))} />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Final</Label>
                                        <Input type="date" className="h-8 text-xs" value={newResp.data_final} onChange={(e) => setNewResp((prev) => ({ ...prev, data_final: e.target.value }))} />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button type="button" size="sm" className="h-7 text-xs" onClick={() => handleAddResponsavel(i)}>Adicionar</Button>
                                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAddingResponsavelToDisc(null); setNewResp({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" }); }}>Cancelar</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs w-full text-muted-foreground hover:text-foreground"
                                    onClick={() => setAddingResponsavelToDisc(i)}
                                  >
                                    <Plus className="h-3 w-3 mr-1" /> Adicionar responsável
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* Ações da disciplina */}
                            {canEdit && (
                              <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingDiscIdx(i); setIsDiscDialogOpen(true); }}>
                                  <Edit className="h-3 w-3 mr-1" /> Editar Disciplina
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => handleRemoveDisc(i)}>
                                  <Trash2 className="h-3 w-3 mr-1" /> Remover
                                </Button>
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
          <Dialog open={isDiscDialogOpen} onOpenChange={(open) => { if (!open) { setIsDiscDialogOpen(false); setEditingDiscIdx(null); setNewObservation(""); } }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Editar Disciplina</DialogTitle>
                <DialogDescription>
                  Altere os dados da disciplina. As mudanças são salvas ao clicar em Salvar.
                </DialogDescription>
              </DialogHeader>

              {editingDiscIdx !== null && projeto.disciplinas[editingDiscIdx] && (
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Disciplina</Label>
                      <Select
                        value={projeto.disciplinas[editingDiscIdx].disciplina}
                        onValueChange={(val) => handleDiscFieldUpdate("disciplina", val)}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {disciplinasCatalog.map((d) => (
                            <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Prioridade</Label>
                      <Select
                        value={projeto.disciplinas[editingDiscIdx].prioridade || PROJECT_PRIORITY.MEDIA}
                        onValueChange={(val) => handleDiscFieldUpdate("prioridade", val)}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((p) => (
                            <SelectItem key={p} value={p}>
                              <span className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${
                                  p === PROJECT_PRIORITY.ALTA ? "bg-red-500" :
                                  p === PROJECT_PRIORITY.MEDIA ? "bg-amber-400" : "bg-blue-400"
                                }`} />
                                {PROJECT_PRIORITY_CONFIG[p].label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={projeto.disciplinas[editingDiscIdx].status || "Não Iniciado"}
                        onValueChange={(val) => handleDiscFieldUpdate("status", val)}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {disciplinaStatusOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Datas (disciplina)</Label>
                      <div className="grid grid-cols-3 gap-1">
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          title="Início"
                          value={projeto.disciplinas[editingDiscIdx].data_inicio || ""}
                          onChange={(e) => handleDiscFieldUpdate("data_inicio", e.target.value)}
                        />
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          title="Previsão"
                          value={projeto.disciplinas[editingDiscIdx].data_previsao || ""}
                          onChange={(e) => handleDiscFieldUpdate("data_previsao", e.target.value)}
                        />
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          title="Final"
                          value={projeto.disciplinas[editingDiscIdx].data_final || ""}
                          onChange={(e) => handleDiscFieldUpdate("data_final", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Label className="flex items-center gap-2 text-xs">
                      <MessageSquare size={14} /> Observações
                    </Label>

                    <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                      {(!projeto.disciplinas[editingDiscIdx].observacoes || projeto.disciplinas[editingDiscIdx].observacoes!.length === 0) ? (
                        <p className="text-xs text-center text-gray-400 py-3">Nenhuma observação</p>
                      ) : (
                        projeto.disciplinas[editingDiscIdx].observacoes!.map((obs, oi) => (
                          <div key={oi} className="bg-white p-2 rounded border shadow-sm text-sm">
                            <p className="text-gray-800">{obs.texto}</p>
                            <div className="flex justify-between items-center mt-1 text-[10px] text-gray-400">
                              <span>{obs.usuario}</span>
                              <span>{new Date(obs.data).toLocaleString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Nova observação..."
                        value={newObservation}
                        onChange={(e) => setNewObservation(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddObservation(); } }}
                        className="h-9"
                      />
                      <Button size="icon" className="h-9 w-9" onClick={handleAddObservation}>
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setIsDiscDialogOpen(false); setEditingDiscIdx(null); setNewObservation(""); }}>
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

        <TabsContent value="orcamento">
          <ProjectBudgetTab projetoId={projeto.id} canEdit={canEdit} disciplinas={projeto.disciplinas} />
        </TabsContent>

        <TabsContent value="marcos">
          <BillingMilestonesTab projetoId={projeto.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="escopo">
          <EscopoTab projetoId={projeto.id} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}

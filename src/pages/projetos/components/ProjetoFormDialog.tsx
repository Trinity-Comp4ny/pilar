import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, DollarSign, Trash2, Edit, MessageSquare, Loader2, MapPin, User, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safeError";
import { PROJECT_STATUS, PROJECT_PRIORITY, PRIORITY_OPTIONS, PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import {
  type Projeto,
  type DisciplinaResponsavel,
  type DisciplinaObservacao,
  type ResponsavelDatas,
  disciplinaStatusOptions,
  getResponsaveisList,
} from "@/pages/projetos/types";
import { type TemplateProjeto } from "@/hooks/useTemplates";

interface ProjetoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProjeto: Projeto | null;
  clientes: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  disciplinas: { id: string; nome: string }[];
  templatesData: TemplateProjeto[];
  currentUser: { name: string; email: string } | null;
  onSaved: () => void;
}

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const EMPTY_FORM = {
  codigo_projeto: "",
  nome: "",
  cliente_id: "",
  localizacao: "",
  loc_cep: "",
  loc_logradouro: "",
  loc_numero: "",
  loc_bairro: "",
  loc_cidade: "",
  loc_estado: "",
  parcelas: "",
  area_m2: "",
  data_inicio: "",
  data_previsao: "",
  data_final: "",
  valor_contrato: "",
  observacao: "",
  status: PROJECT_STATUS.PLANEJAMENTO as Projeto["status"],
  prioridade: PROJECT_PRIORITY.MEDIA as ProjectPriority,
};

function composeLocalizacao(form: typeof EMPTY_FORM): string {
  const parts = [
    form.loc_logradouro,
    form.loc_numero,
    form.loc_bairro,
    form.loc_cidade,
    form.loc_estado,
  ].filter(Boolean);
  return parts.join(", ");
}

function parseLocalizacao(loc: string) {
  const parts = loc.split(",").map((s) => s.trim());
  if (parts.length >= 4) {
    return {
      loc_logradouro: parts[0],
      loc_numero: parts.length >= 5 ? parts[1] : "",
      loc_bairro: parts.length >= 5 ? parts[2] : parts[1],
      loc_cidade: parts.length >= 5 ? parts[3] : parts[2],
      loc_estado: parts.length >= 5 ? parts[4] : parts[3],
    };
  }
  return { loc_logradouro: loc, loc_numero: "", loc_bairro: "", loc_cidade: "", loc_estado: "" };
}

const EMPTY_TEMP_DISCIPLINA: Partial<DisciplinaResponsavel> = {
  disciplina: "",
  responsavel_id: "",
  data_inicio: "",
  data_previsao: "",
  data_final: "",
  status: "Não Iniciado",
  prioridade: PROJECT_PRIORITY.MEDIA,
  observacoes: [],
};

export function ProjetoFormDialog({
  open,
  onOpenChange,
  editProjeto,
  clientes,
  pessoas,
  disciplinas,
  templatesData,
  currentUser,
  onSaved,
}: ProjetoFormDialogProps) {
  const { toast } = useToast();
  const isEditMode = editProjeto !== null;
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [projetosDisciplinas, setProjetosDisciplinas] = useState<DisciplinaResponsavel[]>([]);
  const [tempDisciplina, setTempDisciplina] = useState<Partial<DisciplinaResponsavel>>(EMPTY_TEMP_DISCIPLINA);
  const [selectedDisciplinaIndex, setSelectedDisciplinaIndex] = useState<number | null>(null);
  const [isDisciplinaDetailOpen, setIsDisciplinaDetailOpen] = useState(false);
  const [newObservation, setNewObservation] = useState("");
  const [expandedFormDiscIdx, setExpandedFormDiscIdx] = useState<number | null>(null);
  const [addingRespToFormDisc, setAddingRespToFormDisc] = useState<number | null>(null);
  const [newFormResp, setNewFormResp] = useState({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" });

  const fetchCep = useCallback(async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast({ title: "CEP não encontrado", variant: "destructive" });
        return;
      }
      setFormData((prev) => ({
        ...prev,
        loc_logradouro: data.logradouro || prev.loc_logradouro,
        loc_bairro: data.bairro || prev.loc_bairro,
        loc_cidade: data.localidade || prev.loc_cidade,
        loc_estado: data.uf || prev.loc_estado,
      }));
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setIsFetchingCep(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!open) return;

    if (editProjeto) {
      const parsed = parseLocalizacao(editProjeto.localizacao || "");
      setFormData({
        codigo_projeto: editProjeto.codigo_projeto,
        nome: editProjeto.nome,
        cliente_id: editProjeto.cliente_id,
        localizacao: editProjeto.localizacao || "",
        loc_cep: "",
        ...parsed,
        parcelas: editProjeto.parcelas || "",
        area_m2: editProjeto.area_m2?.toString() || "",
        data_inicio: editProjeto.data_inicio || "",
        data_previsao: editProjeto.data_previsao || "",
        data_final: editProjeto.data_final || "",
        valor_contrato:
          editProjeto.valor_contrato !== undefined
            ? formatCurrencyInput((editProjeto.valor_contrato * 100).toString())
            : "",
        observacao: editProjeto.observacao || "",
        status: editProjeto.status,
        prioridade: editProjeto.prioridade || PROJECT_PRIORITY.MEDIA,
      });
      setProjetosDisciplinas(editProjeto.disciplinas || []);
    } else {
      setFormData(EMPTY_FORM);
      setProjetosDisciplinas([]);
    }

    setTempDisciplina(EMPTY_TEMP_DISCIPLINA);
    setSelectedDisciplinaIndex(null);
    setIsDisciplinaDetailOpen(false);
    setNewObservation("");
    setIsSaving(false);
  }, [open, editProjeto]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenDisciplinaDetail = (index: number) => {
    setSelectedDisciplinaIndex(index);
    setIsDisciplinaDetailOpen(true);
  };

  const handleAddObservation = () => {
    if (!newObservation.trim() || selectedDisciplinaIndex === null) return;

    const updatedDisciplinas = [...projetosDisciplinas];
    const discipline = updatedDisciplinas[selectedDisciplinaIndex];

    const newObs: DisciplinaObservacao = {
      id: crypto.randomUUID(),
      texto: newObservation,
      usuario: currentUser?.name || "Usuário",
      data: new Date().toISOString(),
    };

    updatedDisciplinas[selectedDisciplinaIndex] = {
      ...discipline,
      observacoes: [...(discipline.observacoes || []), newObs],
    };

    setProjetosDisciplinas(updatedDisciplinas);
    setNewObservation("");
  };

  const updateDisciplinaField = (field: keyof DisciplinaResponsavel, value: string) => {
    if (selectedDisciplinaIndex === null) return;
    const updatedDisciplinas = [...projetosDisciplinas];
    updatedDisciplinas[selectedDisciplinaIndex] = {
      ...updatedDisciplinas[selectedDisciplinaIndex],
      [field]: value,
    };
    setProjetosDisciplinas(updatedDisciplinas);
  };

  const addProjetoDisciplina = () => {
    if (!tempDisciplina.disciplina || !tempDisciplina.responsavel_id) return;

    const pessoa = pessoas.find((p) => p.id === tempDisciplina.responsavel_id);

    const novaDisciplina: DisciplinaResponsavel = {
      disciplina: tempDisciplina.disciplina,
      responsavel_id: tempDisciplina.responsavel_id,
      responsavel_nome: pessoa?.nome || "",
      data_inicio: tempDisciplina.data_inicio,
      data_previsao: tempDisciplina.data_previsao,
      data_final: tempDisciplina.data_final,
      status: tempDisciplina.status || "Não Iniciado",
      prioridade: tempDisciplina.prioridade || PROJECT_PRIORITY.MEDIA,
      observacoes: tempDisciplina.observacoes || [],
      responsaveis: [{
        responsavel_id: tempDisciplina.responsavel_id!,
        responsavel_nome: pessoa?.nome || "",
        data_inicio: tempDisciplina.data_inicio,
        data_previsao: tempDisciplina.data_previsao,
        data_final: tempDisciplina.data_final,
        status: tempDisciplina.status || "Não Iniciado",
      }],
    };

    setProjetosDisciplinas([...projetosDisciplinas, novaDisciplina]);
    setTempDisciplina(EMPTY_TEMP_DISCIPLINA);
  };

  const removeProjetoDisciplina = (index: number) => {
    setProjetosDisciplinas((prev) => prev.filter((_, i) => i !== index));
    if (expandedFormDiscIdx === index) setExpandedFormDiscIdx(null);
  };

  const addResponsavelToDisc = (discIdx: number) => {
    if (!newFormResp.responsavel_id) return;
    const pessoa = pessoas.find((p) => p.id === newFormResp.responsavel_id);
    const updated = [...projetosDisciplinas];
    const disc = updated[discIdx];
    const currentResps = getResponsaveisList(disc);

    if (currentResps.some((r) => r.responsavel_id === newFormResp.responsavel_id)) {
      toast({ variant: "destructive", title: "Responsável já adicionado nesta disciplina" });
      return;
    }

    const novoResp: ResponsavelDatas = {
      responsavel_id: newFormResp.responsavel_id,
      responsavel_nome: pessoa?.nome || "",
      data_inicio: newFormResp.data_inicio || undefined,
      data_previsao: newFormResp.data_previsao || undefined,
      data_final: newFormResp.data_final || undefined,
      status: "Não Iniciado",
    };

    updated[discIdx] = { ...disc, responsaveis: [...currentResps, novoResp] };
    setProjetosDisciplinas(updated);
    setNewFormResp({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" });
    setAddingRespToFormDisc(null);
  };

  const removeResponsavelFromDisc = (discIdx: number, respIdx: number) => {
    const updated = [...projetosDisciplinas];
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
    setProjetosDisciplinas(updated);
  };

  const updateRespDatasInForm = (discIdx: number, respIdx: number, field: keyof ResponsavelDatas, value: string) => {
    const updated = [...projetosDisciplinas];
    const disc = updated[discIdx];
    const resps = [...getResponsaveisList(disc)];
    resps[respIdx] = { ...resps[respIdx], [field]: value };
    updated[discIdx] = { ...disc, responsaveis: resps };
    setProjetosDisciplinas(updated);
  };

  const applyTemplate = (templateId: string) => {
    const template = templatesData.find((t) => t.id === templateId);
    if (!template) return;

    const novasDisciplinas: DisciplinaResponsavel[] = template.fases.flatMap((fase) =>
      fase.disciplinas.map((d) => ({
        disciplina: d.disciplina,
        responsavel_id: "",
        responsavel_nome: "",
        status: "Não Iniciado",
        observacoes: [],
      }))
    );

    setProjetosDisciplinas(novasDisciplinas);
    toast({
      title: "Template aplicado",
      description: `${novasDisciplinas.length} disciplina(s) adicionadas de "${template.nome}"`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo_projeto || !formData.cliente_id || !formData.nome) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha Código, Nome e Cliente",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const localizacaoComposta = composeLocalizacao(formData) || formData.localizacao;

    try {
      if (isEditMode && editProjeto) {
        const { error } = await supabase.rpc("update_projeto_completo", {
          p_projeto_id: editProjeto.id,
          p_codigo: formData.codigo_projeto,
          p_nome: formData.nome,
          p_cliente_id: formData.cliente_id,
          p_data_inicio: formData.data_inicio || null,
          p_data_previsao: formData.data_previsao || null,
          p_data_final: formData.data_final || null,
          p_valor_contrato: parseCurrencyString(formData.valor_contrato) || 0,
          p_observacao: formData.observacao,
          p_localizacao: localizacaoComposta,
          p_parcelas: formData.parcelas || null,
          p_area_m2: parseFloat(formData.area_m2) || 0,
          p_disciplinas: projetosDisciplinas,
          p_status: formData.status,
          p_prioridade: formData.prioridade,
        });

        if (error) throw error;

        toast({
          title: "Projeto atualizado",
          description: "Projeto foi atualizado com sucesso",
        });
      } else {
        const { error } = await supabase.rpc("create_projeto_completo", {
          p_codigo: formData.codigo_projeto,
          p_nome: formData.nome,
          p_cliente_id: formData.cliente_id,
          p_data_inicio: formData.data_inicio || null,
          p_data_previsao: formData.data_previsao || null,
          p_data_final: formData.data_final || null,
          p_valor_contrato: parseCurrencyString(formData.valor_contrato) || 0,
          p_observacao: formData.observacao,
          p_localizacao: localizacaoComposta,
          p_parcelas: formData.parcelas || null,
          p_area_m2: parseFloat(formData.area_m2) || 0,
          p_disciplinas: projetosDisciplinas,
          p_prioridade: formData.prioridade,
        });

        if (error) throw error;

        toast({
          title: "Projeto cadastrado",
          description: "Novo projeto foi adicionado com sucesso",
        });
      }

      onOpenChange(false);
      onSaved();

      if (localizacaoComposta.trim()) {
        supabase.functions.invoke("geocode-address", {
          body: { address: localizacaoComposta.trim() },
        }).then(({ data: geoData }) => {
          if (geoData?.found && geoData.lat && geoData.lng) {
            const query = isEditMode && editProjeto
              ? supabase.from("projetos").update({ latitude: geoData.lat, longitude: geoData.lng }).eq("id", editProjeto.id)
              : supabase.from("projetos").update({ latitude: geoData.lat, longitude: geoData.lng }).eq("codigo_projeto", formData.codigo_projeto);
            query.then(() => onSaved());
          }
        }).catch(() => {
          toast({
            title: "Geocodificação falhou",
            description: "Não foi possível obter coordenadas do endereço. O projeto não aparecerá no mapa.",
          });
        });
      } else if (isEditMode && editProjeto) {
        supabase
          .from("projetos")
          .update({ latitude: null, longitude: null })
          .eq("id", editProjeto.id)
          .then(() => onSaved());
      }
    } catch (err: unknown) {
      toast({
        title: "Erro ao salvar",
        description: getSafeErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Atualize as informações do projeto"
              : "Cadastre um novo projeto e defina os responsáveis técnicos"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {!isEditMode && templatesData.length > 0 && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-dashed">
              <Label className="text-xs text-muted-foreground">Criar a partir de template</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione um template (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {templatesData.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome} ({t.tipo_servico})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo_projeto">Código do Projeto *</Label>
              <Input
                id="codigo_projeto"
                value={formData.codigo_projeto}
                onChange={(e) => handleInputChange("codigo_projeto", e.target.value)}
                placeholder="PRJ-2024-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente *</Label>
              <Select
                value={formData.cliente_id}
                onValueChange={(value) => handleInputChange("cliente_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="nome">Nome do Projeto *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => handleInputChange("nome", e.target.value)}
                placeholder="Ex: Residência Silva - Reforma Completa"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(value) => handleInputChange("prioridade", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
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

          <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <MapPin size={12} /> Localização da Obra
            </Label>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">CEP</Label>
                <div className="relative">
                  <Input
                    value={formData.loc_cep}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                      handleInputChange("loc_cep", formatted);
                      if (v.length === 8) fetchCep(v);
                    }}
                    placeholder="00000-000"
                    className="h-9 pr-8"
                    maxLength={9}
                  />
                  {isFetchingCep && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Logradouro</Label>
                <Input
                  value={formData.loc_logradouro}
                  onChange={(e) => handleInputChange("loc_logradouro", e.target.value)}
                  placeholder="Rua, Av, Travessa..."
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Número</Label>
                <Input
                  value={formData.loc_numero}
                  onChange={(e) => handleInputChange("loc_numero", e.target.value)}
                  placeholder="Nº"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Bairro</Label>
                <Input
                  value={formData.loc_bairro}
                  onChange={(e) => handleInputChange("loc_bairro", e.target.value)}
                  placeholder="Bairro"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cidade</Label>
                <Input
                  value={formData.loc_cidade}
                  onChange={(e) => handleInputChange("loc_cidade", e.target.value)}
                  placeholder="Cidade"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={formData.loc_estado} onValueChange={(v) => handleInputChange("loc_estado", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="area_m2">Área (m²)</Label>
            <Input
              id="area_m2"
              type="number"
              step="0.01"
              value={formData.area_m2}
              onChange={(e) => handleInputChange("area_m2", e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-3">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <DollarSign size={12} /> Financeiro
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="valorTotal" className="text-xs">Valor (R$)</Label>
                  <Input
                    id="valorTotal"
                    type="text"
                    value={formData.valor_contrato}
                    onChange={(e) => handleInputChange("valor_contrato", formatCurrencyInput(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="parcelas" className="text-xs">Parcelas</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    min="1"
                    value={formData.parcelas}
                    onChange={(e) => handleInputChange("parcelas", e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Calendar size={12} /> Prazos
              </Label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dataInicio" className="text-xs">Início</Label>
                    <Input id="dataInicio" type="date" value={formData.data_inicio} onChange={(e) => handleInputChange("data_inicio", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dataPrevisao" className="text-xs">Previsão</Label>
                    <Input id="dataPrevisao" type="date" value={formData.data_previsao} onChange={(e) => handleInputChange("data_previsao", e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dataFinal" className="text-xs">Final Real</Label>
                  <Input id="dataFinal" type="date" value={formData.data_final} onChange={(e) => handleInputChange("data_final", e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Label className="text-base font-semibold mb-3 block">Disciplinas e Prazos</Label>

            <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Disciplina</Label>
                <Select
                  value={tempDisciplina.disciplina}
                  onValueChange={(val) => setTempDisciplina({ ...tempDisciplina, disciplina: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplinas.map((d) => (
                      <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Responsável</Label>
                <Select
                  value={tempDisciplina.responsavel_id}
                  onValueChange={(val) => setTempDisciplina({ ...tempDisciplina, responsavel_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {pessoas.map((pessoa) => (
                      <SelectItem key={pessoa.id} value={pessoa.id}>{pessoa.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Prioridade</Label>
                <Select
                  value={tempDisciplina.prioridade}
                  onValueChange={(val) => setTempDisciplina({ ...tempDisciplina, prioridade: val as ProjectPriority })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Média" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${
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

              <div className="grid grid-cols-3 gap-2 md:col-span-2">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="date"
                    value={tempDisciplina.data_inicio}
                    onChange={(e) => setTempDisciplina({ ...tempDisciplina, data_inicio: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Previsão</Label>
                  <Input
                    type="date"
                    value={tempDisciplina.data_previsao}
                    onChange={(e) => setTempDisciplina({ ...tempDisciplina, data_previsao: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Final</Label>
                  <Input
                    type="date"
                    value={tempDisciplina.data_final}
                    onChange={(e) => setTempDisciplina({ ...tempDisciplina, data_final: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <Button type="button" onClick={addProjetoDisciplina} className="md:col-span-2 w-full" variant="secondary">
                <Plus size={16} className="mr-2" /> Adicionar Disciplina
              </Button>
            </div>

            {projetosDisciplinas.length > 0 && (
              <div className="space-y-2 mt-4">
                {projetosDisciplinas.map((pd, idx) => {
                  const resps = getResponsaveisList(pd);
                  const isExpanded = expandedFormDiscIdx === idx;

                  return (
                    <div key={idx} className="bg-white border rounded-lg hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between p-3">
                        <div
                          className="flex items-center gap-2 flex-1 cursor-pointer"
                          onClick={() => setExpandedFormDiscIdx(isExpanded ? null : idx)}
                        >
                          <Badge variant="outline">{pd.disciplina}</Badge>
                          {pd.prioridade && (
                            <span className={`text-[10px] px-1.5 py-0 rounded-full font-medium ${PROJECT_PRIORITY_CONFIG[pd.prioridade as ProjectPriority]?.bgColor || ""} ${PROJECT_PRIORITY_CONFIG[pd.prioridade as ProjectPriority]?.color || ""}`}>
                              {PROJECT_PRIORITY_CONFIG[pd.prioridade as ProjectPriority]?.label || pd.prioridade}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {resps.length} {resps.length === 1 ? "resp." : "resps."}
                          </span>
                          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenDisciplinaDetail(idx)} className="h-6 w-6 p-0 text-blue-500">
                            <Edit size={14} />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeProjetoDisciplina(idx)} className="h-6 w-6 p-0 text-red-500">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>

                      {/* Resumo quando fechado */}
                      {!isExpanded && (
                        <div className="px-3 pb-3">
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{resps.map((r) => r.responsavel_nome).join(", ")}</span>
                            <span className={`${
                              pd.status === "Concluído" ? "text-green-600" :
                              pd.status === "Em Andamento" ? "text-blue-600" : "text-gray-600"
                            }`}>
                              {pd.status || "Não Iniciado"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Detalhe expandido - responsáveis com datas */}
                      {isExpanded && (
                        <div className="border-t px-3 pb-3 space-y-2 mt-0">
                          <div className="pt-2 space-y-2">
                            {resps.map((resp, rIdx) => (
                              <div key={rIdx} className="bg-gray-50 rounded-lg p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs font-medium">{resp.responsavel_nome}</span>
                                  </div>
                                  {resps.length > 1 && (
                                    <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-500" onClick={() => removeResponsavelFromDisc(idx, rIdx)}>
                                      <Trash2 size={10} />
                                    </Button>
                                  )}
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                  <div className="space-y-0.5">
                                    <Label className="text-[9px] text-muted-foreground">Início</Label>
                                    <Input
                                      type="date"
                                      className="h-7 text-[10px]"
                                      value={resp.data_inicio || ""}
                                      onChange={(e) => updateRespDatasInForm(idx, rIdx, "data_inicio", e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-0.5">
                                    <Label className="text-[9px] text-muted-foreground">Previsão</Label>
                                    <Input
                                      type="date"
                                      className="h-7 text-[10px]"
                                      value={resp.data_previsao || ""}
                                      onChange={(e) => updateRespDatasInForm(idx, rIdx, "data_previsao", e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-0.5">
                                    <Label className="text-[9px] text-muted-foreground">Final</Label>
                                    <Input
                                      type="date"
                                      className="h-7 text-[10px]"
                                      value={resp.data_final || ""}
                                      onChange={(e) => updateRespDatasInForm(idx, rIdx, "data_final", e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {addingRespToFormDisc === idx ? (
                            <div className="bg-blue-50/50 rounded-lg p-2.5 border border-dashed border-blue-200 space-y-2">
                              <Select value={newFormResp.responsavel_id} onValueChange={(v) => setNewFormResp((prev) => ({ ...prev, responsavel_id: v }))}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                                <SelectContent>
                                  {pessoas.map((p) => (
                                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="grid grid-cols-3 gap-1.5">
                                <div className="space-y-0.5">
                                  <Label className="text-[9px] text-muted-foreground">Início</Label>
                                  <Input type="date" className="h-7 text-[10px]" value={newFormResp.data_inicio} onChange={(e) => setNewFormResp((prev) => ({ ...prev, data_inicio: e.target.value }))} />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[9px] text-muted-foreground">Previsão</Label>
                                  <Input type="date" className="h-7 text-[10px]" value={newFormResp.data_previsao} onChange={(e) => setNewFormResp((prev) => ({ ...prev, data_previsao: e.target.value }))} />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[9px] text-muted-foreground">Final</Label>
                                  <Input type="date" className="h-7 text-[10px]" value={newFormResp.data_final} onChange={(e) => setNewFormResp((prev) => ({ ...prev, data_final: e.target.value }))} />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button type="button" size="sm" className="h-6 text-[10px]" onClick={() => addResponsavelToDisc(idx)}>Adicionar</Button>
                                <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setAddingRespToFormDisc(null); setNewFormResp({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" }); }}>Cancelar</Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] w-full text-muted-foreground"
                              onClick={() => setAddingRespToFormDisc(idx)}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Adicionar responsável
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Dialog open={isDisciplinaDetailOpen} onOpenChange={setIsDisciplinaDetailOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Detalhes da Disciplina</DialogTitle>
                <DialogDescription>
                  {selectedDisciplinaIndex !== null && projetosDisciplinas[selectedDisciplinaIndex]?.disciplina} -{" "}
                  {selectedDisciplinaIndex !== null && projetosDisciplinas[selectedDisciplinaIndex]?.responsavel_nome}
                </DialogDescription>
              </DialogHeader>

              {selectedDisciplinaIndex !== null && (
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Disciplina</Label>
                      <Select
                        value={projetosDisciplinas[selectedDisciplinaIndex].disciplina}
                        onValueChange={(val) => updateDisciplinaField("disciplina", val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {disciplinas.map((d) => (
                            <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Responsável</Label>
                      <Select
                        value={projetosDisciplinas[selectedDisciplinaIndex].responsavel_id}
                        onValueChange={(val) => {
                          const pessoa = pessoas.find((p) => p.id === val);
                          const updatedDisciplinas = [...projetosDisciplinas];
                          updatedDisciplinas[selectedDisciplinaIndex] = {
                            ...updatedDisciplinas[selectedDisciplinaIndex],
                            responsavel_id: val,
                            responsavel_nome: pessoa?.nome || "",
                          };
                          setProjetosDisciplinas(updatedDisciplinas);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pessoas.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={projetosDisciplinas[selectedDisciplinaIndex].status}
                        onValueChange={(val) => updateDisciplinaField("status", val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {disciplinaStatusOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <Select
                        value={projetosDisciplinas[selectedDisciplinaIndex].prioridade || PROJECT_PRIORITY.MEDIA}
                        onValueChange={(val) => updateDisciplinaField("prioridade", val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Início</Label>
                      <Input
                        type="date"
                        value={projetosDisciplinas[selectedDisciplinaIndex].data_inicio || ""}
                        onChange={(e) => updateDisciplinaField("data_inicio", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Previsão</Label>
                      <Input
                        type="date"
                        value={projetosDisciplinas[selectedDisciplinaIndex].data_previsao || ""}
                        onChange={(e) => updateDisciplinaField("data_previsao", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Final</Label>
                      <Input
                        type="date"
                        value={projetosDisciplinas[selectedDisciplinaIndex].data_final || ""}
                        onChange={(e) => updateDisciplinaField("data_final", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Label className="flex items-center gap-2">
                      <MessageSquare size={16} /> Observações
                    </Label>

                    <div className="bg-gray-50 rounded-lg p-3 h-48 overflow-y-auto space-y-3">
                      {projetosDisciplinas[selectedDisciplinaIndex].observacoes?.length === 0 ? (
                        <p className="text-xs text-center text-gray-400 py-4">Nenhuma observação registrada</p>
                      ) : (
                        projetosDisciplinas[selectedDisciplinaIndex].observacoes?.map((obs, i) => (
                          <div key={i} className="bg-white p-2 rounded border shadow-sm text-sm">
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddObservation();
                          }
                        }}
                      />
                      <Button type="button" size="icon" onClick={handleAddObservation}>
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>

                  <Button onClick={() => setIsDisciplinaDetailOpen(false)} className="w-full mt-2" variant="outline">
                    Fechar
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="observacao">Observação Geral</Label>
            <Textarea
              id="observacao"
              value={formData.observacao}
              onChange={(e) => handleInputChange("observacao", e.target.value)}
              placeholder="Observações gerais do projeto"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4 md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white" disabled={isSaving}>
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                isEditMode ? "Atualizar" : "Salvar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

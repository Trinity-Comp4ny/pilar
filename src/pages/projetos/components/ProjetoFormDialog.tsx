import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, DollarSign, FileText, Info, Layers, Loader2, MapPin, User } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { formatCurrencyInput } from "@/lib/currencyUtils";
import { toast } from "sonner";
import { PROJECT_PRIORITY, PRIORITY_OPTIONS, PROJECT_PRIORITY_CONFIG } from "@/constants";
import { type Projeto, type ProjetoDisciplinaDB } from "@/types/projetos";
import { type TemplateProjeto } from "@/hooks/useTemplates";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";
import { useProjetoForm, ESTADOS_BR } from "./useProjetoForm";
import { DisciplinasSection } from "./DisciplinasSection";
import { DisciplinaDetailDialog } from "./DisciplinaDetailDialog";

interface ProjetoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProjeto: Projeto | null;
  clientes: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  disciplinas: { id: string; nome: string }[];
  templatesData: TemplateProjeto[];
  fluxosData?: FluxoDisciplinas[];
  currentUser: { name: string; email: string } | null;
  onSaved: () => void;
  /** Disciplinas existentes do banco (usadas em modo edição para exibição read-only) */
  existingDisciplinas?: ProjetoDisciplinaDB[];
}

type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string; icon: typeof FileText; desc: string }[] = [
  { id: 1, label: "Identificação", icon: FileText, desc: "Código, cliente e localização" },
  { id: 2, label: "Escopo & Prazo", icon: Calendar, desc: "Valor, parcelas e datas" },
  { id: 3, label: "Disciplinas", icon: Layers, desc: "Equipe e responsabilidades" },
];

export function ProjetoFormDialog({
  open,
  onOpenChange,
  editProjeto,
  clientes,
  pessoas,
  disciplinas,
  templatesData,
  fluxosData = [],
  currentUser,
  onSaved,
  existingDisciplinas = [],
}: ProjetoFormDialogProps) {
  const form = useProjetoForm({
    open,
    onOpenChange,
    editProjeto,
    pessoas,
    templatesData,
    fluxosData,
    currentUser,
    onSaved,
  });

  const [step, setStep] = useState<Step>(1);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  const selectedDisciplina =
    form.selectedDisciplinaIndex !== null ? form.projetosDisciplinas[form.selectedDisciplinaIndex] : null;

  const validateStep1 = () => {
    if (!form.formData.codigo_projeto || !form.formData.nome || !form.formData.cliente_id) {
      toast.error("Preencha código, nome e cliente para continuar");
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep((step + 1) as Step);
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const goToStep = (target: Step) => {
    if (form.isEditMode) {
      setStep(target);
      return;
    }
    if (target < step) {
      setStep(target);
      return;
    }
    if (target === step + 1 && step === 1 && !validateStep1()) return;
    setStep(target);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.isEditMode ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
          <DialogDescription>{STEPS.find((s) => s.id === step)?.desc}</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 pt-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            const isClickable = form.isEditMode || s.id <= step;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => isClickable && goToStep(s.id)}
                  disabled={!isClickable}
                  className={cn(
                    "flex items-center gap-2 flex-1 p-2 rounded-lg transition-colors text-left",
                    isClickable && "hover:bg-muted",
                    !isClickable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
                      isActive && "bg-brand text-ink",
                      isCompleted && "bg-brand text-ink",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <div className="hidden sm:block min-w-0">
                    <p
                      className={cn(
                        "text-xs font-medium truncate",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Passo {s.id}</p>
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px flex-1 mx-1", step > s.id ? "bg-brand" : "bg-muted")} />
                )}
              </div>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 3) form.handleSubmit();
          }}
          className="space-y-4 mt-4"
        >
          {/* STEP 1 — Identificação */}
          {step === 1 && (
            <div className="space-y-4">
              {!form.isEditMode && templatesData.length > 0 && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-dashed">
                  <Label className="text-xs text-muted-foreground">Criar a partir de template</Label>
                  <Select onValueChange={form.applyTemplate}>
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
                    value={form.formData.codigo_projeto}
                    onChange={(e) => form.handleInputChange("codigo_projeto", e.target.value)}
                    placeholder="PRJ-2024-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Select
                    value={form.formData.cliente_id}
                    onValueChange={(value) => form.handleInputChange("cliente_id", value)}
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
                    value={form.formData.nome}
                    onChange={(e) => form.handleInputChange("nome", e.target.value)}
                    placeholder="Ex: Residência Silva - Reforma Completa"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={form.formData.prioridade}
                    onValueChange={(value) => form.handleInputChange("prioridade", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                p === PROJECT_PRIORITY.ALTA
                                  ? "bg-red-500"
                                  : p === PROJECT_PRIORITY.MEDIA
                                    ? "bg-amber-400"
                                    : "bg-blue-400"
                              }`}
                            />
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
                        value={form.formData.loc_cep}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                          const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                          form.handleInputChange("loc_cep", formatted);
                          if (v.length === 8) form.fetchCep(v);
                        }}
                        placeholder="00000-000"
                        className="h-9 pr-8"
                        maxLength={9}
                      />
                      {form.isFetchingCep && (
                        <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Logradouro</Label>
                    <Input
                      value={form.formData.loc_logradouro}
                      onChange={(e) => form.handleInputChange("loc_logradouro", e.target.value)}
                      placeholder="Rua, Av, Travessa..."
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Número</Label>
                    <Input
                      value={form.formData.loc_numero}
                      onChange={(e) => form.handleInputChange("loc_numero", e.target.value)}
                      placeholder="Nº"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bairro</Label>
                    <Input
                      value={form.formData.loc_bairro}
                      onChange={(e) => form.handleInputChange("loc_bairro", e.target.value)}
                      placeholder="Bairro"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cidade</Label>
                    <Input
                      value={form.formData.loc_cidade}
                      onChange={(e) => form.handleInputChange("loc_cidade", e.target.value)}
                      placeholder="Cidade"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Estado</Label>
                    <Select
                      value={form.formData.loc_estado}
                      onValueChange={(v) => form.handleInputChange("loc_estado", v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
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
                  value={form.formData.area_m2}
                  onChange={(e) => form.handleInputChange("area_m2", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* STEP 2 — Escopo & Prazo */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-3">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <DollarSign size={12} /> Financeiro
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="valorTotal" className="text-xs">
                      Valor (R$)
                    </Label>
                    <Input
                      id="valorTotal"
                      type="text"
                      value={form.formData.valor_contrato}
                      onChange={(e) => form.handleInputChange("valor_contrato", formatCurrencyInput(e.target.value))}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="parcelas" className="text-xs">
                      Parcelas
                    </Label>
                    <Input
                      id="parcelas"
                      type="number"
                      min="1"
                      value={form.formData.parcelas}
                      onChange={(e) => form.handleInputChange("parcelas", e.target.value)}
                      placeholder="1"
                    />
                  </div>
                </div>
                {!form.isEditMode && (
                  <div className="space-y-1.5">
                    <Label htmlFor="diaPagamento" className="text-xs">
                      Dia fixo de pagamento (opcional)
                    </Label>
                    <Input
                      id="diaPagamento"
                      type="number"
                      min="1"
                      max="31"
                      value={form.formData.dia_pagamento}
                      onChange={(e) => form.handleInputChange("dia_pagamento", e.target.value)}
                      placeholder="Ex: 25"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Gera parcelas automáticas vencendo neste dia de cada mês. Pula fim de semana.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <Calendar size={12} /> Prazos
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dataInicio" className="text-xs">
                      Início
                    </Label>
                    <DatePicker
                      id="dataInicio"
                      value={form.formData.data_inicio}
                      onChange={(v) => form.handleInputChange("data_inicio", v)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prazoDiasUteis" className="text-xs">
                      Prazo (dias úteis)
                    </Label>
                    <Input
                      id="prazoDiasUteis"
                      type="number"
                      min="1"
                      max="999"
                      value={form.formData.prazo_dias_uteis}
                      onChange={(e) => form.handleInputChange("prazo_dias_uteis", e.target.value)}
                      placeholder="60"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dataPrevisao" className="text-xs">
                      Previsão
                    </Label>
                    <DatePicker
                      id="dataPrevisao"
                      value={form.formData.data_previsao}
                      onChange={(v) => form.handleInputChange("data_previsao", v)}
                      minDate={form.formData.data_inicio || undefined}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dataFinal" className="text-xs">
                      Final Real
                    </Label>
                    <DatePicker
                      id="dataFinal"
                      value={form.formData.data_final}
                      onChange={(v) => form.handleInputChange("data_final", v)}
                      minDate={form.formData.data_inicio || undefined}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t">
                <Label htmlFor="observacao">Observação Geral</Label>
                <Textarea
                  id="observacao"
                  value={form.formData.observacao}
                  onChange={(e) => form.handleInputChange("observacao", e.target.value)}
                  placeholder="Observações gerais do projeto"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* STEP 3 — Disciplinas */}
          {step === 3 && (
            <>
              {form.isEditMode ? (
                <div className="space-y-3">
                  <Label className="text-base font-semibold block">Disciplinas do Projeto</Label>

                  <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                    <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      As disciplinas podem ser editadas diretamente na tabela de disciplinas do projeto.
                    </span>
                  </div>

                  {existingDisciplinas.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">
                      Nenhuma disciplina cadastrada neste projeto ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {existingDisciplinas.map((d) => (
                        <div key={d.id} className="rounded-lg border bg-white px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{d.nome}</Badge>
                              {d.prioridade && (
                                <span className="text-[10px] text-muted-foreground">{d.prioridade}</span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-[10px] font-medium",
                                d.status === "Concluído"
                                  ? "text-positive"
                                  : d.status === "Em Andamento"
                                    ? "text-blue-600"
                                    : "text-gray-500"
                              )}
                            >
                              {d.status}
                            </span>
                          </div>
                          {(d.responsaveis ?? []).length > 0 && (
                            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3 flex-shrink-0" />
                              <span>{(d.responsaveis ?? []).map((r) => r.nome).join(", ")}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <DisciplinasSection
                  disciplinas={disciplinas}
                  pessoas={pessoas}
                  fluxosData={fluxosData}
                  onApplyFluxo={form.applyFluxo}
                  projetosDisciplinas={form.projetosDisciplinas}
                  tempDisciplina={form.tempDisciplina}
                  onTempDisciplinaChange={form.setTempDisciplina}
                  onAddDisciplina={form.addProjetoDisciplina}
                  onRemoveDisciplina={form.removeProjetoDisciplina}
                  onOpenDetail={form.handleOpenDisciplinaDetail}
                  expandedFormDiscIdx={form.expandedFormDiscIdx}
                  onExpandToggle={form.setExpandedFormDiscIdx}
                  addingRespToFormDisc={form.addingRespToFormDisc}
                  onSetAddingResp={form.setAddingRespToFormDisc}
                  newFormResp={form.newFormResp}
                  onNewFormRespChange={form.setNewFormResp}
                  onAddResponsavel={form.addResponsavelToDisc}
                  onRemoveResponsavel={form.removeResponsavelFromDisc}
                  onUpdateRespDatas={form.updateRespDatasInForm}
                  projetoDataInicio={form.formData.data_inicio || undefined}
                  projetoDataPrevisao={form.formData.data_previsao || undefined}
                  projetoDataFinal={form.formData.data_final || undefined}
                />
              )}
            </>
          )}

          <DisciplinaDetailDialog
            open={form.isDisciplinaDetailOpen}
            onOpenChange={form.setIsDisciplinaDetailOpen}
            disciplina={selectedDisciplina}
            disciplinas={disciplinas}
            pessoas={pessoas}
            onUpdateField={form.updateDisciplinaField}
            onUpdateResponsavel={form.updateDisciplinaResponsavel}
            newObservation={form.newObservation}
            onNewObservationChange={form.setNewObservation}
            onAddObservation={form.handleAddObservation}
          />

          {/* Footer */}
          <div className="flex items-center gap-2 pt-4 border-t">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={goBack} disabled={form.isSaving}>
                Voltar
              </Button>
            ) : (
              <div />
            )}
            <div className="flex-1" />
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={form.isSaving}>
              Cancelar
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={goNext} className="bg-brand hover:bg-brand/90 text-ink">
                Próximo →
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => form.handleSubmit()}
                className="bg-brand hover:bg-brand/90 text-ink"
                disabled={form.isSaving}
              >
                {form.isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : form.isEditMode ? (
                  "Atualizar"
                ) : (
                  "Salvar"
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

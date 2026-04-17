import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, DollarSign, Loader2, MapPin } from "lucide-react";
import { formatCurrencyInput } from "@/lib/currencyUtils";
import { PROJECT_PRIORITY, PRIORITY_OPTIONS, PROJECT_PRIORITY_CONFIG } from "@/constants";
import { type Projeto } from "@/pages/projetos/types";
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
}

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

  const selectedDisciplina =
    form.selectedDisciplinaIndex !== null ? form.projetosDisciplinas[form.selectedDisciplinaIndex] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.isEditMode ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
          <DialogDescription>
            {form.isEditMode
              ? "Atualize as informações do projeto"
              : "Cadastre um novo projeto e defina os responsáveis técnicos"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit} className="space-y-4 mt-4">
          {/* Template selector */}
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

          {/* Code + Client */}
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

          {/* Name + Priority */}
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

          {/* Location */}
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
                <Select value={form.formData.loc_estado} onValueChange={(v) => form.handleInputChange("loc_estado", v)}>
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

          {/* Area */}
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

          {/* Financial + Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
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
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Calendar size={12} /> Prazos
              </Label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dataInicio" className="text-xs">
                      Início
                    </Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={form.formData.data_inicio}
                      onChange={(e) => form.handleInputChange("data_inicio", e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dataPrevisao" className="text-xs">
                      Previsão
                    </Label>
                    <Input
                      id="dataPrevisao"
                      type="date"
                      value={form.formData.data_previsao}
                      onChange={(e) => form.handleInputChange("data_previsao", e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dataFinal" className="text-xs">
                    Final Real
                  </Label>
                  <Input
                    id="dataFinal"
                    type="date"
                    value={form.formData.data_final}
                    onChange={(e) => form.handleInputChange("data_final", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Disciplinas */}
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
          />

          {/* Disciplina detail dialog */}
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

          {/* Observation + Buttons */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="observacao">Observação Geral</Label>
            <Textarea
              id="observacao"
              value={form.formData.observacao}
              onChange={(e) => form.handleInputChange("observacao", e.target.value)}
              placeholder="Observações gerais do projeto"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={form.isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white"
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
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

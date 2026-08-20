import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useMemo, useState } from "react";
import { Plus, Trash2, Edit, User, Info, AlertTriangle, Clock, GitBranch, X } from "lucide-react";
import { PROJECT_PRIORITY, PRIORITY_OPTIONS, PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import {
  type DisciplinaResponsavel,
  type ResponsavelDatas,
  getResponsaveisList,
  getDiscDeadlineStatus,
} from "@/types/projetos";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";
import { formatDateShort } from "@/lib/format";
import { groupByEtapa } from "./FluxoPipeline";
import { FluxoPipelineGraph, type FluxoPipelineStage } from "./FluxoPipelineGraph";

function buildWizardPreviewStages(groups: ReturnType<typeof groupByEtapa>): FluxoPipelineStage[] {
  return groups
    .filter((g) => g.etapa != null)
    .map((group) => ({
      key: String(group.etapa),
      titulo: group.nome,
      nodes: group.disciplinas.map((disc, i) => ({
        key: disc.id ?? `${group.etapa}-${i}`,
        titulo: disc.disciplina,
        status: "nao_iniciado" as const,
        responsavelNome: disc.responsavel_nome || undefined,
        metaLabel: disc.data_previsao ? formatDateShort(disc.data_previsao) : undefined,
        checklistLabel: disc.checklist_padrao?.length ? `${disc.checklist_padrao.length} itens` : undefined,
      })),
    }));
}

interface DisciplinasSectionProps {
  disciplinas: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  fluxosData?: FluxoDisciplinas[];
  onApplyFluxo?: (fluxoId: string | null) => void;
  projetosDisciplinas: DisciplinaResponsavel[];
  tempDisciplina: Partial<DisciplinaResponsavel>;
  onTempDisciplinaChange: (val: Partial<DisciplinaResponsavel>) => void;
  onAddDisciplina: () => void;
  onRemoveDisciplina: (index: number) => void;
  onOpenDetail: (index: number) => void;
  addingRespToFormDisc: number | null;
  onSetAddingResp: (index: number | null) => void;
  newFormResp: { responsavel_id: string; data_inicio: string; data_previsao: string; data_final: string };
  onNewFormRespChange: (val: {
    responsavel_id: string;
    data_inicio: string;
    data_previsao: string;
    data_final: string;
  }) => void;
  onAddResponsavel: (discIdx: number) => void;
  onRemoveResponsavel: (discIdx: number, respIdx: number) => void;
  onUpdateRespDatas: (discIdx: number, respIdx: number, field: keyof ResponsavelDatas, value: string) => void;
  projetoDataInicio?: string;
  projetoDataPrevisao?: string;
  projetoDataFinal?: string;
}

export function DisciplinasSection({
  disciplinas,
  pessoas,
  fluxosData = [],
  onApplyFluxo,
  projetosDisciplinas,
  tempDisciplina,
  onTempDisciplinaChange,
  onAddDisciplina,
  onRemoveDisciplina,
  onOpenDetail,
  addingRespToFormDisc,
  onSetAddingResp,
  newFormResp,
  onNewFormRespChange,
  onAddResponsavel,
  onRemoveResponsavel,
  onUpdateRespDatas,
  projetoDataInicio,
  projetoDataPrevisao,
  projetoDataFinal,
}: DisciplinasSectionProps) {
  const [selectedFluxoId, setSelectedFluxoId] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);

  const minDate = projetoDataInicio || undefined;
  const maxDate = projetoDataPrevisao || undefined;
  const maxFinalDate = projetoDataFinal || undefined;

  const isOutOfRange = (date?: string): boolean => {
    if (!date) return false;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isFinalOutOfRange = (date?: string): boolean => {
    if (!date) return false;
    if (minDate && date < minDate) return true;
    if (maxFinalDate && date > maxFinalDate) return true;
    return false;
  };

  const handleFluxoChange = (value: string) => {
    setSelectedFluxoId(value);
    onApplyFluxo?.(value || null);
  };

  const handleClearFluxo = () => {
    setSelectedFluxoId("");
    onApplyFluxo?.(null);
  };

  const showFluxoSelector = fluxosData.length > 0 && onApplyFluxo && projetosDisciplinas.length === 0;

  const groups = useMemo(() => groupByEtapa(projetosDisciplinas), [projetosDisciplinas]);
  const hasEtapas = groups.some((g) => g.etapa != null);
  const previewStages = useMemo(() => (hasEtapas ? buildWizardPreviewStages(groups) : []), [groups, hasEtapas]);

  return (
    <div className="pt-2">
      <Label className="text-base font-semibold mb-3 block">Disciplinas e Prazos</Label>

      {/* Fluxo selector — inside disciplinas section, only when no disciplines yet */}
      {showFluxoSelector && (
        <div className="mb-4 p-3 bg-info-soft/50 rounded-lg border border-dashed border-info-mid-border">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
            <GitBranch className="h-3.5 w-3.5" />
            Aplicar fluxo de disciplinas
          </Label>
          <div className="flex gap-2">
            <Select value={selectedFluxoId} onValueChange={handleFluxoChange}>
              <SelectTrigger className="h-9 flex-1">
                <SelectValue placeholder="Selecione um fluxo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {fluxosData.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome} ({f.etapas.length} etapa{f.etapas.length !== 1 ? "s" : ""})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            O fluxo define a ordem das disciplinas em etapas sequenciais
          </p>
        </div>
      )}

      {/* Applied fluxo indicator — when disciplines were applied from a fluxo */}
      {hasEtapas && (
        <div className="mb-3 flex items-center gap-2 p-2 bg-info-soft rounded-lg border border-info-mid-border">
          <GitBranch className="h-3.5 w-3.5 text-info-mid flex-shrink-0" />
          <span className="text-xs text-info-strong flex-1">
            {selectedFluxoId
              ? `Fluxo aplicado: ${fluxosData.find((f) => f.id === selectedFluxoId)?.nome}`
              : "Fluxo de etapas aplicado"}
          </span>
          {selectedFluxoId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-info-mid hover:text-danger-mid"
              onClick={handleClearFluxo}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      )}

      {/* Prévia do prazo: grafo das etapas aplicadas */}
      {previewStages.length > 0 && (
        <div className="mb-4 bg-white border rounded-lg p-3">
          <FluxoPipelineGraph stages={previewStages} />
        </div>
      )}

      {/* Disciplinas list */}
      {projetosDisciplinas.length > 0 && (
        <div className="space-y-2 mt-4">
          {groups.map((group) => (
            <div key={group.etapa ?? "avulsas"} className="space-y-2">
              {hasEtapas && (
                <div className="flex items-center gap-2 pt-2">
                  {group.etapa != null && (
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-info-soft text-info-strong text-[10px] font-bold flex-shrink-0">
                      {group.etapa}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-muted-foreground">{group.nome}</span>
                  {group.etapa != null && group.disciplinas.length > 1 && (
                    <span className="text-[9px] text-info-mid bg-info-soft rounded px-1.5 py-0.5">paralelo</span>
                  )}
                </div>
              )}
              {group.disciplinas.map((pd) => {
                const idx = projetosDisciplinas.indexOf(pd);
                const resps = getResponsaveisList(pd);
                const deadlineStatus = getDiscDeadlineStatus(pd);

                return (
                  <div
                    key={idx}
                    className={`bg-white border rounded-lg transition-shadow ${deadlineStatus?.status_data === "em_atraso" ? "border-danger-mid-border" : ""}`}
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{pd.disciplina}</Badge>
                        {pd.prioridade && (
                          <span
                            className={`text-[10px] px-1.5 py-0 rounded-full font-medium ${PROJECT_PRIORITY_CONFIG[pd.prioridade as ProjectPriority]?.bgColor || ""} ${PROJECT_PRIORITY_CONFIG[pd.prioridade as ProjectPriority]?.color || ""}`}
                          >
                            {PROJECT_PRIORITY_CONFIG[pd.prioridade as ProjectPriority]?.label || pd.prioridade}
                          </span>
                        )}
                        {deadlineStatus &&
                          (deadlineStatus.status_data === "em_atraso" || deadlineStatus.status_data === "atencao") && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${
                                deadlineStatus.status_data === "em_atraso"
                                  ? "bg-danger-soft text-danger-strong"
                                  : "bg-warning-soft text-warning-strong"
                              }`}
                            >
                              {deadlineStatus.status_data === "em_atraso" ? (
                                <AlertTriangle size={10} />
                              ) : (
                                <Clock size={10} />
                              )}
                              {deadlineStatus.label} {deadlineStatus.days > 0 ? `(${deadlineStatus.days}d)` : ""}
                            </span>
                          )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenDetail(idx)}
                          className="h-6 w-6 p-0 text-info-mid"
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveDisciplina(idx)}
                          className="h-6 w-6 p-0 text-danger-mid"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>

                    {/* Responsável + status row */}
                    <div className="flex items-center gap-2 px-3 pb-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3 flex-shrink-0" />
                      <span>{resps.map((r) => r.responsavel_nome).join(", ")}</span>
                      <span
                        className={`ml-auto text-[10px] font-medium ${
                          pd.status === "Concluído"
                            ? "text-positive-strong"
                            : pd.status === "Em Andamento"
                              ? "text-info-mid"
                              : "text-ink-muted"
                        }`}
                      >
                        {pd.status || "Não Iniciado"}
                      </span>
                    </div>

                    {/* Datas sempre visíveis, sem toggle */}
                    <div className="border-t px-3 pb-3 space-y-3 bg-info-soft/30">
                      <div className="pt-2 space-y-3">
                        {resps.map((resp, rIdx) => {
                          const semPrazo = group.etapa != null && !resp.data_previsao;
                          return (
                            <div key={rIdx} className="space-y-2">
                              {resps.length > 1 && (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {resp.responsavel_nome}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 text-danger-mid"
                                    onClick={() => onRemoveResponsavel(idx, rIdx)}
                                  >
                                    <Trash2 size={10} />
                                  </Button>
                                </div>
                              )}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">
                                    Início
                                  </Label>
                                  <DatePicker
                                    value={resp.data_inicio}
                                    onChange={(v) => onUpdateRespDatas(idx, rIdx, "data_inicio", v)}
                                    minDate={minDate}
                                    maxDate={maxDate}
                                    className={
                                      isOutOfRange(resp.data_inicio)
                                        ? "border-attention-mid-border bg-attention-soft"
                                        : ""
                                    }
                                  />
                                  {isOutOfRange(resp.data_inicio) && (
                                    <p className="text-[9px] text-attention-mid">Fora do prazo do projeto</p>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">
                                    Previsão
                                  </Label>
                                  {semPrazo ? (
                                    <div className="h-9 flex items-center gap-1.5 px-2 rounded-md border border-dashed bg-muted text-[11px] text-muted-foreground">
                                      <Info className="h-3 w-3 flex-shrink-0" />
                                      sem prazo definido
                                    </div>
                                  ) : (
                                    <DatePicker
                                      value={resp.data_previsao}
                                      onChange={(v) => onUpdateRespDatas(idx, rIdx, "data_previsao", v)}
                                      minDate={minDate}
                                      maxDate={maxDate}
                                      className={
                                        isOutOfRange(resp.data_previsao)
                                          ? "border-attention-mid-border bg-attention-soft"
                                          : ""
                                      }
                                    />
                                  )}
                                  {semPrazo && (
                                    <p className="text-[9px] text-muted-foreground">
                                      Etapa sem duração configurada no fluxo
                                    </p>
                                  )}
                                  {!semPrazo && isOutOfRange(resp.data_previsao) && (
                                    <p className="text-[9px] text-attention-mid">Fora do prazo do projeto</p>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">
                                    Conclusão
                                  </Label>
                                  <DatePicker
                                    value={resp.data_final}
                                    onChange={(v) => onUpdateRespDatas(idx, rIdx, "data_final", v)}
                                    minDate={minDate}
                                    maxDate={maxFinalDate}
                                    className={
                                      isFinalOutOfRange(resp.data_final)
                                        ? "border-attention-mid-border bg-attention-soft"
                                        : ""
                                    }
                                  />
                                  {isFinalOutOfRange(resp.data_final) && (
                                    <p className="text-[9px] text-attention-mid">
                                      {minDate && resp.data_final! < minDate
                                        ? "Anterior ao início do projeto"
                                        : "Posterior à conclusão do projeto"}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {addingRespToFormDisc === idx ? (
                        <div className="bg-info-soft rounded-lg p-2.5 border border-dashed border-info-mid-border space-y-2">
                          <Select
                            value={newFormResp.responsavel_id}
                            onValueChange={(v) => onNewFormRespChange({ ...newFormResp, responsavel_id: v })}
                          >
                            <SelectTrigger className="h-7 text-xs">
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
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">Início</Label>
                              <DatePicker
                                value={newFormResp.data_inicio}
                                onChange={(v) => onNewFormRespChange({ ...newFormResp, data_inicio: v })}
                                minDate={minDate}
                                maxDate={maxDate}
                              />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">Previsão</Label>
                              <DatePicker
                                value={newFormResp.data_previsao}
                                onChange={(v) => onNewFormRespChange({ ...newFormResp, data_previsao: v })}
                                minDate={minDate}
                                maxDate={maxDate}
                              />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">Final</Label>
                              <DatePicker
                                value={newFormResp.data_final}
                                onChange={(v) => onNewFormRespChange({ ...newFormResp, data_final: v })}
                                minDate={minDate}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="brand"
                              size="sm"
                              className="h-6 text-[10px]"
                              onClick={() => onAddResponsavel(idx)}
                            >
                              Adicionar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px]"
                              onClick={() => {
                                onSetAddingResp(null);
                                onNewFormRespChange({
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
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] w-full text-muted-foreground"
                          onClick={() => onSetAddingResp(idx)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Adicionar responsável
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Add disciplina */}
      <div className="mt-3">
        {showAddForm ? (
          <div className="bg-muted p-4 rounded-lg border space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Disciplina</Label>
              <Select
                value={tempDisciplina.disciplina}
                onValueChange={(val) => onTempDisciplinaChange({ ...tempDisciplina, disciplina: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {disciplinas.map((d) => (
                    <SelectItem key={d.id} value={d.nome}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsável</Label>
              <Select
                value={tempDisciplina.responsavel_id}
                onValueChange={(val) => onTempDisciplinaChange({ ...tempDisciplina, responsavel_id: val })}
                disabled={pessoas.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={pessoas.length === 0 ? "Nenhuma pessoa cadastrada" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {pessoas.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      Cadastre membros em <strong>Pessoas</strong> para atribuir responsáveis.
                    </div>
                  ) : (
                    pessoas.map((pessoa) => (
                      <SelectItem key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Prioridade</Label>
              <Select
                value={tempDisciplina.prioridade}
                onValueChange={(val) =>
                  onTempDisciplinaChange({ ...tempDisciplina, prioridade: val as ProjectPriority })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Média" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
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

            {minDate && maxDate && (
              <p className="text-[10px] text-muted-foreground bg-info-soft border border-info-soft-border rounded px-2 py-1">
                Prazo do projeto: {formatDateShort(minDate)} → {formatDateShort(maxDate)}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Início</Label>
                <DatePicker
                  value={tempDisciplina.data_inicio?.slice(0, 10)}
                  onChange={(v) => onTempDisciplinaChange({ ...tempDisciplina, data_inicio: v })}
                  minDate={minDate}
                  maxDate={maxDate}
                  className={
                    isOutOfRange(tempDisciplina.data_inicio) ? "border-attention-mid-border bg-attention-soft" : ""
                  }
                />
                {isOutOfRange(tempDisciplina.data_inicio) && (
                  <p className="text-[9px] text-attention-mid">Fora do prazo do projeto</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Previsão</Label>
                <DatePicker
                  value={tempDisciplina.data_previsao?.slice(0, 10)}
                  onChange={(v) => onTempDisciplinaChange({ ...tempDisciplina, data_previsao: v })}
                  minDate={minDate}
                  maxDate={maxDate}
                  className={
                    isOutOfRange(tempDisciplina.data_previsao) ? "border-attention-mid-border bg-attention-soft" : ""
                  }
                />
                {isOutOfRange(tempDisciplina.data_previsao) && (
                  <p className="text-[9px] text-attention-mid">Fora do prazo do projeto</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Final</Label>
                <DatePicker
                  value={tempDisciplina.data_final?.slice(0, 10)}
                  onChange={(v) => onTempDisciplinaChange({ ...tempDisciplina, data_final: v })}
                  minDate={minDate}
                  className={
                    tempDisciplina.data_final && tempDisciplina.data_final < (minDate ?? "")
                      ? "border-attention-mid-border bg-attention-soft"
                      : ""
                  }
                />
                {tempDisciplina.data_final && tempDisciplina.data_final < (minDate ?? "") && (
                  <p className="text-[9px] text-attention-mid">Anterior ao início do projeto</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  onAddDisciplina();
                  setShowAddForm(false);
                }}
                variant="brand"
                className="flex-1 h-11 text-sm font-semibold"
                disabled={!tempDisciplina.disciplina}
              >
                <Plus size={18} className="mr-2" /> Incluir na lista
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed border-2 h-12 text-sm font-medium hover:bg-muted/50"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={18} className="mr-2" /> Adicionar nova disciplina
          </Button>
        )}
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Edit,
  User,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  GitBranch,
  X,
  CalendarDays,
} from "lucide-react";
import { PROJECT_PRIORITY, PRIORITY_OPTIONS, PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import {
  type DisciplinaResponsavel,
  type ResponsavelDatas,
  getResponsaveisList,
  getDiscDeadlineStatus,
} from "@/types/projetos";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";
import { groupByEtapa } from "./FluxoPipeline";

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
  expandedFormDiscIdx: number | null;
  onExpandToggle: (index: number | null) => void;
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
  expandedFormDiscIdx,
  onExpandToggle,
  addingRespToFormDisc,
  onSetAddingResp,
  newFormResp,
  onNewFormRespChange,
  onAddResponsavel,
  onRemoveResponsavel,
  onUpdateRespDatas,
  projetoDataInicio,
  projetoDataPrevisao,
}: DisciplinasSectionProps) {
  const [selectedFluxoId, setSelectedFluxoId] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);

  const minDate = projetoDataInicio || undefined;
  const maxDate = projetoDataPrevisao || undefined;

  const isOutOfRange = (date?: string): boolean => {
    if (!date) return false;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
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

  return (
    <div className="pt-2">
      <Label className="text-base font-semibold mb-3 block">Disciplinas e Prazos</Label>

      {/* Fluxo selector — inside disciplinas section, only when no disciplines yet */}
      {showFluxoSelector && (
        <div className="mb-4 p-3 bg-blue-50/50 rounded-lg border border-dashed border-blue-200">
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
      {projetosDisciplinas.length > 0 && projetosDisciplinas.some((d) => d.etapa != null) && selectedFluxoId && (
        <div className="mb-3 flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
          <GitBranch className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
          <span className="text-xs text-blue-700 flex-1">
            Fluxo aplicado: {fluxosData.find((f) => f.id === selectedFluxoId)?.nome}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-blue-500 hover:text-red-500"
            onClick={handleClearFluxo}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Disciplinas list */}
      {projetosDisciplinas.length > 0 && (
        <div className="space-y-2 mt-4">
          {(() => {
            const hasEtapas = projetosDisciplinas.some((d) => d.etapa != null);
            const groups = hasEtapas
              ? groupByEtapa(projetosDisciplinas)
              : [{ etapa: null, nome: "", disciplinas: projetosDisciplinas }];

            return groups.map((group) => (
              <div key={group.etapa ?? "avulsas"} className="space-y-2">
                {hasEtapas && (
                  <div className="flex items-center gap-2 pt-2">
                    {group.etapa != null && (
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex-shrink-0">
                        {group.etapa}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-muted-foreground">{group.nome}</span>
                    {group.etapa != null && group.disciplinas.length > 1 && (
                      <span className="text-[9px] text-blue-500 bg-blue-50 rounded px-1.5 py-0.5">paralelo</span>
                    )}
                  </div>
                )}
                {group.disciplinas.map((pd) => {
                  const idx = projetosDisciplinas.indexOf(pd);
                  const resps = getResponsaveisList(pd);
                  const isExpanded = expandedFormDiscIdx === idx;
                  const deadlineStatus = getDiscDeadlineStatus(pd);
                  const hasDates = resps.some((r) => r.data_inicio || r.data_previsao || r.data_final);
                  const fmt = (d?: string) => d?.split("-").reverse().join("/") ?? "";

                  return (
                    <div
                      key={idx}
                      className={`bg-white border rounded-lg transition-shadow ${deadlineStatus?.status_data === "em_atraso" ? "border-red-300" : ""}`}
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
                            (deadlineStatus.status_data === "em_atraso" ||
                              deadlineStatus.status_data === "atencao") && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${
                                  deadlineStatus.status_data === "em_atraso"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
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
                            className="h-6 w-6 p-0 text-blue-500"
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveDisciplina(idx)}
                            className="h-6 w-6 p-0 text-red-500"
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
                              ? "text-positive"
                              : pd.status === "Em Andamento"
                                ? "text-blue-600"
                                : "text-gray-500"
                          }`}
                        >
                          {pd.status || "Não Iniciado"}
                        </span>
                      </div>

                      {/* Dates toggle row */}
                      <button
                        type="button"
                        onClick={() => onExpandToggle(isExpanded ? null : idx)}
                        className={`w-full flex items-center gap-2 px-3 py-2 border-t text-xs transition-colors ${
                          isExpanded
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : hasDates
                              ? "bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100"
                        }`}
                      >
                        <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                        {hasDates ? (
                          <span className="flex-1 text-left flex items-center gap-4">
                            <span>
                              Início: <strong>{fmt(resps[0]?.data_inicio) || "—"}</strong>
                            </span>
                            <span>
                              Previsão: <strong>{fmt(resps[0]?.data_previsao) || "—"}</strong>
                            </span>
                            <span>
                              Conclusão: <strong>{fmt(resps[0]?.data_final) || "—"}</strong>
                            </span>
                          </span>
                        ) : (
                          <span className="flex-1 text-left font-medium">Definir datas</span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 ml-auto" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                        )}
                      </button>

                      {/* Expanded date inputs */}
                      {isExpanded && (
                        <div className="border-t px-3 pb-3 space-y-3 bg-blue-50/30">
                          <div className="pt-2 space-y-3">
                            {resps.map((resp, rIdx) => (
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
                                      className="h-5 w-5 p-0 text-red-400"
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
                                      className={isOutOfRange(resp.data_inicio) ? "border-orange-400 bg-orange-50" : ""}
                                    />
                                    {isOutOfRange(resp.data_inicio) && (
                                      <p className="text-[9px] text-orange-600">Fora do prazo do projeto</p>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">
                                      Previsão
                                    </Label>
                                    <DatePicker
                                      value={resp.data_previsao}
                                      onChange={(v) => onUpdateRespDatas(idx, rIdx, "data_previsao", v)}
                                      minDate={minDate}
                                      maxDate={maxDate}
                                      className={
                                        isOutOfRange(resp.data_previsao) ? "border-orange-400 bg-orange-50" : ""
                                      }
                                    />
                                    {isOutOfRange(resp.data_previsao) && (
                                      <p className="text-[9px] text-orange-600">Fora do prazo do projeto</p>
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
                                      className={
                                        resp.data_final && resp.data_final < (minDate ?? "")
                                          ? "border-orange-400 bg-orange-50"
                                          : ""
                                      }
                                    />
                                    {resp.data_final && resp.data_final < (minDate ?? "") && (
                                      <p className="text-[9px] text-orange-600">Anterior ao início do projeto</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {addingRespToFormDisc === idx ? (
                            <div className="bg-blue-50 rounded-lg p-2.5 border border-dashed border-blue-200 space-y-2">
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
                      )}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      )}

      {/* Add disciplina */}
      <div className="mt-3">
        {showAddForm ? (
          <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
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
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {pessoas.map((pessoa) => (
                    <SelectItem key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </SelectItem>
                  ))}
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
              <p className="text-[10px] text-muted-foreground bg-blue-50 border border-blue-100 rounded px-2 py-1">
                Prazo do projeto: {minDate.split("-").reverse().join("/")} → {maxDate.split("-").reverse().join("/")}
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
                  className={isOutOfRange(tempDisciplina.data_inicio) ? "border-orange-400 bg-orange-50" : ""}
                />
                {isOutOfRange(tempDisciplina.data_inicio) && (
                  <p className="text-[9px] text-orange-600">Fora do prazo do projeto</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Previsão</Label>
                <DatePicker
                  value={tempDisciplina.data_previsao?.slice(0, 10)}
                  onChange={(v) => onTempDisciplinaChange({ ...tempDisciplina, data_previsao: v })}
                  minDate={minDate}
                  maxDate={maxDate}
                  className={isOutOfRange(tempDisciplina.data_previsao) ? "border-orange-400 bg-orange-50" : ""}
                />
                {isOutOfRange(tempDisciplina.data_previsao) && (
                  <p className="text-[9px] text-orange-600">Fora do prazo do projeto</p>
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
                      ? "border-orange-400 bg-orange-50"
                      : ""
                  }
                />
                {tempDisciplina.data_final && tempDisciplina.data_final < (minDate ?? "") && (
                  <p className="text-[9px] text-orange-600">Anterior ao início do projeto</p>
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
                className="flex-1"
                variant="secondary"
              >
                <Plus size={16} className="mr-2" /> Adicionar
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
            className="w-full border-dashed text-muted-foreground"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={16} className="mr-2" /> Adicionar Disciplina
          </Button>
        )}
      </div>
    </div>
  );
}

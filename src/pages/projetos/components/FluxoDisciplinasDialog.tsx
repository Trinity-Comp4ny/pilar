import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TarefasEditor } from "@/components/TarefasEditor";
import { toast } from "sonner";
import { useFluxosDisciplinas, useCreateFluxo, useUpdateFluxo, useDeleteFluxo } from "@/hooks/useFluxosDisciplinas";
import type { FluxoDisciplinas, FluxoEtapa } from "@/types/fluxoDisciplinas";
import { FluxoPipelineGraph, type FluxoPipelineStage } from "./FluxoPipelineGraph";
import {
  Plus,
  Trash2,
  Edit,
  ArrowUp,
  ArrowDown,
  X,
  ArrowLeft,
  GitBranch,
  Layers,
  User,
  ListChecks,
} from "lucide-react";

interface FluxoDisciplinasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplinas: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
}

/** Etapa do form: `_key` é só de UI (estável ao reordenar), nunca persistida. */
type FluxoEtapaForm = FluxoEtapa & { _key: string };

interface FluxoFormState {
  nome: string;
  descricao: string;
  etapas: FluxoEtapaForm[];
}

function novaEtapaForm(ordem: number): FluxoEtapaForm {
  return { ordem, nome: `Etapa ${ordem}`, disciplinas: [], _key: crypto.randomUUID() };
}

const emptyForm: FluxoFormState = { nome: "", descricao: "", etapas: [] };

function buildPreviewStages(etapas: FluxoEtapaForm[]): FluxoPipelineStage[] {
  return etapas.map((etapa, i) => ({
    key: etapa._key,
    titulo: etapa.nome || `Etapa ${i + 1}`,
    subtitulo: etapa.duracao_dias_uteis ? `${etapa.duracao_dias_uteis} dias úteis` : undefined,
    nodes: etapa.disciplinas.map((disc, di) => ({
      key: `${etapa._key}-${di}`,
      titulo: disc.nome,
      status: "nao_iniciado" as const,
      responsavelNome: disc.responsavel_nome || undefined,
      checklistLabel: disc.checklist_padrao?.length ? `${disc.checklist_padrao.length} itens` : undefined,
    })),
  }));
}

export function FluxoDisciplinasDialog({ open, onOpenChange, disciplinas, pessoas }: FluxoDisciplinasDialogProps) {
  const { data: fluxos = [] } = useFluxosDisciplinas();
  const createFluxo = useCreateFluxo();
  const updateFluxo = useUpdateFluxo();
  const deleteFluxo = useDeleteFluxo();

  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FluxoFormState>(emptyForm);
  const [expandedEtapas, setExpandedEtapas] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resetToList = () => {
    setMode("list");
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEdit = (fluxo: FluxoDisciplinas) => {
    const etapas = fluxo.etapas.map((e) => ({
      ...e,
      disciplinas: e.disciplinas.map((d) => ({ ...d })),
      _key: crypto.randomUUID(),
    }));
    setEditingId(fluxo.id);
    setForm({ nome: fluxo.nome, descricao: fluxo.descricao || "", etapas });
    setExpandedEtapas(etapas.map((e) => e._key));
    setMode("form");
  };

  const handleNew = () => {
    const etapa = novaEtapaForm(1);
    setEditingId(null);
    setForm({ nome: "", descricao: "", etapas: [etapa] });
    setExpandedEtapas([etapa._key]);
    setMode("form");
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteFluxo.mutateAsync(confirmDeleteId);
      toast.success("Fluxo excluído");
    } catch {
      toast.error("Erro ao excluir fluxo");
    }
    setConfirmDeleteId(null);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome do fluxo é obrigatório");
      return;
    }
    if (form.etapas.length === 0) {
      toast.error("Adicione pelo menos uma etapa");
      return;
    }
    const etapaVazia = form.etapas.find((e) => e.disciplinas.length === 0);
    if (etapaVazia) {
      toast.error(`Etapa "${etapaVazia.nome}" não tem disciplinas`);
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || undefined,
      etapas: form.etapas.map(({ _key, ...etapa }, i) => ({ ...etapa, ordem: i + 1 })),
    };

    try {
      if (editingId) {
        await updateFluxo.mutateAsync({ id: editingId, ...payload });
        toast.success("Fluxo atualizado");
      } else {
        await createFluxo.mutateAsync(payload);
        toast.success("Fluxo criado");
      }
      resetToList();
    } catch {
      toast.error("Erro ao salvar fluxo");
    }
  };

  const addEtapa = () => {
    const etapa = novaEtapaForm(form.etapas.length + 1);
    setForm((prev) => ({ ...prev, etapas: [...prev.etapas, etapa] }));
    setExpandedEtapas((prev) => [...prev, etapa._key]);
  };

  const removeEtapa = (index: number) => {
    setForm((prev) => ({ ...prev, etapas: prev.etapas.filter((_, i) => i !== index) }));
  };

  const updateEtapaNome = (index: number, nome: string) => {
    setForm((prev) => ({
      ...prev,
      etapas: prev.etapas.map((e, i) => (i === index ? { ...e, nome } : e)),
    }));
  };

  const updateEtapaDuracao = (index: number, raw: string) => {
    const parsed = raw.trim() ? Math.max(1, parseInt(raw, 10)) : undefined;
    setForm((prev) => ({
      ...prev,
      etapas: prev.etapas.map((e, i) =>
        i === index ? { ...e, duracao_dias_uteis: Number.isNaN(parsed) ? undefined : parsed } : e
      ),
    }));
  };

  const moveEtapa = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= form.etapas.length) return;
    setForm((prev) => {
      const etapas = [...prev.etapas];
      [etapas[index], etapas[target]] = [etapas[target], etapas[index]];
      return { ...prev, etapas };
    });
  };

  const addDisciplinaToEtapa = (etapaIndex: number, disciplinaNome: string) => {
    setForm((prev) => ({
      ...prev,
      etapas: prev.etapas.map((e, i) =>
        i === etapaIndex ? { ...e, disciplinas: [...e.disciplinas, { nome: disciplinaNome }] } : e
      ),
    }));
  };

  const removeDisciplinaFromEtapa = (etapaIndex: number, discIndex: number) => {
    setForm((prev) => ({
      ...prev,
      etapas: prev.etapas.map((e, i) =>
        i === etapaIndex ? { ...e, disciplinas: e.disciplinas.filter((_, di) => di !== discIndex) } : e
      ),
    }));
  };

  const updateDisciplinaResponsavel = (etapaIndex: number, discIndex: number, pessoaId: string) => {
    const pessoa = pessoas.find((p) => p.id === pessoaId);
    setForm((prev) => ({
      ...prev,
      etapas: prev.etapas.map((e, i) =>
        i === etapaIndex
          ? {
              ...e,
              disciplinas: e.disciplinas.map((d, di) =>
                di === discIndex ? { ...d, responsavel_id: pessoaId, responsavel_nome: pessoa?.nome || "" } : d
              ),
            }
          : e
      ),
    }));
  };

  const updateDisciplinaChecklist = (etapaIndex: number, discIndex: number, checklist: string[]) => {
    setForm((prev) => ({
      ...prev,
      etapas: prev.etapas.map((e, i) =>
        i === etapaIndex
          ? {
              ...e,
              disciplinas: e.disciplinas.map((d, di) => (di === discIndex ? { ...d, checklist_padrao: checklist } : d)),
            }
          : e
      ),
    }));
  };

  const usedDisciplinas = new Set(form.etapas.flatMap((e) => e.disciplinas.map((d) => d.nome)));
  const totalDisciplinas = form.etapas.reduce((sum, e) => sum + e.disciplinas.length, 0);
  const previewStages = useMemo(() => buildPreviewStages(form.etapas), [form.etapas]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) resetToList();
          onOpenChange(v);
        }}
      >
        <DialogContent
          className={
            mode === "form"
              ? "max-w-none w-[94vw] h-[88vh] p-0 gap-0 overflow-hidden flex flex-col"
              : "sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          }
        >
          {mode === "list" ? (
            <div className="space-y-4 mt-2">
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Fluxos de disciplinas
              </DialogTitle>

              <Button onClick={handleNew} variant="brand" className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Novo fluxo
              </Button>

              {fluxos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum fluxo criado ainda</p>
                  <p className="text-xs mt-1">Crie um fluxo para definir a ordem das disciplinas nos projetos</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {fluxos.map((fluxo) => {
                    const totalDiscs = fluxo.etapas.reduce((s, e) => s + e.disciplinas.length, 0);
                    return (
                      <div
                        key={fluxo.id}
                        className="bg-muted rounded-lg p-3 border hover:border-border transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm">{fluxo.nome}</h4>
                            {fluxo.descricao && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{fluxo.descricao}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {fluxo.etapas.length} etapa{fluxo.etapas.length !== 1 ? "s" : ""}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {totalDiscs} disciplina{totalDiscs !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              {fluxo.etapas.map((etapa, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  {i > 0 && <span className="text-muted-foreground text-[10px]">→</span>}
                                  <span className="text-[10px] bg-white border rounded px-1.5 py-0.5">
                                    {etapa.disciplinas.map((d) => d.nome).join(", ")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-info-mid"
                              onClick={() => handleEdit(fluxo)}
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-danger-mid"
                              onClick={() => setConfirmDeleteId(fluxo.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex-shrink-0 border-b px-6 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-sm -ml-2" onClick={resetToList}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                  </Button>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <GitBranch className="h-4 w-4" />
                    {editingId ? "Editar fluxo" : "Novo fluxo"}
                  </DialogTitle>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nome do Fluxo *</Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Fluxo Residencial"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Descrição</Label>
                    <Input
                      value={form.descricao}
                      onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Opcional"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
                <ResizablePanel defaultSize={62} minSize={40}>
                  <div className="h-full overflow-y-auto p-5 space-y-3">
                    <Label className="text-sm font-semibold block">
                      Etapas ({form.etapas.length}), {totalDisciplinas} disciplina{totalDisciplinas !== 1 ? "s" : ""}
                    </Label>

                    <Accordion
                      type="multiple"
                      value={expandedEtapas}
                      onValueChange={setExpandedEtapas}
                      className="space-y-3"
                    >
                      {form.etapas.map((etapa, etapaIdx) => {
                        const selectableDisciplinas = disciplinas
                          .filter(
                            (d) => !usedDisciplinas.has(d.nome) || etapa.disciplinas.some((ed) => ed.nome === d.nome)
                          )
                          .filter((d) => !etapa.disciplinas.some((ed) => ed.nome === d.nome));

                        return (
                          <AccordionItem
                            key={etapa._key}
                            value={etapa._key}
                            className="rounded-lg border bg-white overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                              <AccordionTrigger className="p-0 hover:no-underline flex-shrink-0">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-info-soft text-info-strong text-sm font-bold">
                                  {etapaIdx + 1}
                                </span>
                              </AccordionTrigger>
                              <Input
                                value={etapa.nome}
                                onChange={(e) => updateEtapaNome(etapaIdx, e.target.value)}
                                placeholder="Nome da etapa"
                                className="h-9 text-sm font-medium flex-1"
                              />
                              <div className="flex items-center gap-1.5 rounded-full border bg-white px-2.5 h-8 flex-shrink-0">
                                <Input
                                  type="number"
                                  min={1}
                                  value={etapa.duracao_dias_uteis ?? ""}
                                  onChange={(e) => updateEtapaDuracao(etapaIdx, e.target.value)}
                                  placeholder="—"
                                  className="h-6 w-9 border-none p-0 text-xs text-right shadow-none focus-visible:ring-0"
                                />
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">dias úteis</span>
                              </div>
                              <div className="flex gap-0.5 flex-shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={etapaIdx === 0}
                                  onClick={() => moveEtapa(etapaIdx, "up")}
                                >
                                  <ArrowUp size={14} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={etapaIdx === form.etapas.length - 1}
                                  onClick={() => moveEtapa(etapaIdx, "down")}
                                >
                                  <ArrowDown size={14} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-danger-mid"
                                  onClick={() => removeEtapa(etapaIdx)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>

                            <AccordionContent className="px-3">
                              <div className="space-y-2 pt-1">
                                {etapa.disciplinas.map((disc, discIdx) => (
                                  <div key={discIdx} className="rounded-md border bg-muted/30 p-2.5 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="text-sm flex-shrink-0">
                                        {disc.nome}
                                      </Badge>
                                      <Select
                                        value={disc.responsavel_id || ""}
                                        onValueChange={(val) => updateDisciplinaResponsavel(etapaIdx, discIdx, val)}
                                      >
                                        <SelectTrigger className="h-8 text-xs flex-1 min-w-[140px]">
                                          <SelectValue placeholder="Responsável (opcional)">
                                            {disc.responsavel_nome ? (
                                              <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {disc.responsavel_nome}
                                              </span>
                                            ) : (
                                              "Responsável (opcional)"
                                            )}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {pessoas.map((p) => (
                                            <SelectItem key={p.id} value={p.id} className="text-sm">
                                              {p.nome}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <button
                                        type="button"
                                        className="text-muted-foreground hover:text-danger-mid flex-shrink-0"
                                        onClick={() => removeDisciplinaFromEtapa(etapaIdx, discIdx)}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                    <div className="border-t pt-2">
                                      <Label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                                        <ListChecks className="h-3 w-3" /> Tarefas do checklist
                                      </Label>
                                      <TarefasEditor
                                        value={disc.checklist_padrao ?? []}
                                        onChange={(next) => updateDisciplinaChecklist(etapaIdx, discIdx, next)}
                                      />
                                    </div>
                                  </div>
                                ))}

                                {selectableDisciplinas.length > 0 && (
                                  <Select onValueChange={(val) => addDisciplinaToEtapa(etapaIdx, val)} value="">
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="Adicionar disciplina..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {selectableDisciplinas.map((d) => (
                                        <SelectItem key={d.id} value={d.nome} className="text-sm">
                                          {d.nome}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}

                                {etapa.disciplinas.length > 1 && (
                                  <p className="text-xs text-muted-foreground">
                                    Disciplinas nesta etapa rodam em paralelo
                                  </p>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                    <Button type="button" variant="outline" size="sm" className="w-full h-9" onClick={addEtapa}>
                      <Plus className="mr-1 h-4 w-4" /> Adicionar etapa
                    </Button>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={38} minSize={25}>
                  <div className="flex h-full flex-col bg-muted/20">
                    <div className="flex-shrink-0 border-b px-4 py-3">
                      <Label className="text-xs font-semibold text-muted-foreground">Prévia ao vivo</Label>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto p-4">
                      {previewStages.length === 0 || totalDisciplinas === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground px-6">
                          <GitBranch className="h-8 w-8 opacity-30" />
                          <p className="text-xs max-w-[200px]">
                            Adicione etapas e disciplinas para ver o fluxo montado aqui
                          </p>
                        </div>
                      ) : (
                        <FluxoPipelineGraph stages={previewStages} />
                      )}
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>

              <div className="flex-shrink-0 border-t px-6 py-4 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={resetToList}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} variant="brand" disabled={createFluxo.isPending || updateFluxo.isPending}>
                  {editingId ? "Salvar alterações" : "Criar fluxo"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(v) => {
          if (!v) setConfirmDeleteId(null);
        }}
        onConfirm={handleDelete}
        title="Excluir fluxo?"
        description="Esta ação não pode ser desfeita. Projetos que já usaram este fluxo não serão afetados."
        confirmText="Excluir"
      />
    </>
  );
}

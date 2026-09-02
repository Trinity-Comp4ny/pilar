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
import { SeletorResponsaveis } from "@/components/SeletorResponsaveis";
import { AvatarStack } from "@/components/AvatarStack";
import { toast } from "sonner";
import { useFluxosDisciplinas, useCreateFluxo, useUpdateFluxo, useDeleteFluxo } from "@/hooks/useFluxosDisciplinas";
import type { FluxoDisciplinas, FluxoDisciplinaTemplate, FluxoChecklistItemTemplate } from "@/types/fluxoDisciplinas";
import { duracaoEfetiva, responsaveisEfetivos } from "@/lib/fluxoCascata";
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
  ListChecks,
  Lock,
} from "lucide-react";

interface FluxoDisciplinasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplinas: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
}

/** Disciplina do form: `_key` é só de UI (estável ao reordenar), nunca persistida. */
type FluxoDisciplinaForm = FluxoDisciplinaTemplate & { _key: string };

interface FluxoFormState {
  nome: string;
  descricao: string;
  disciplinas: FluxoDisciplinaForm[];
}

const emptyForm: FluxoFormState = { nome: "", descricao: "", disciplinas: [] };

/** Colunas (posições `ordem`) derivadas das disciplinas — não existe entidade "coluna" persistida. */
function colunas(disciplinas: { ordem: number }[]): number[] {
  return Array.from(new Set(disciplinas.map((d) => d.ordem))).sort((a, b) => a - b);
}

/** Reatribui `ordem` pra ficar contíguo (1..N) a partir das colunas em uso, sem buracos após remoção. */
function renumerarOrdens(disciplinas: FluxoDisciplinaForm[]): FluxoDisciplinaForm[] {
  const mapa = new Map(colunas(disciplinas).map((ordem, i) => [ordem, i + 1]));
  return disciplinas.map((d) => ({ ...d, ordem: mapa.get(d.ordem)! }));
}

function buildPreviewStages(disciplinas: FluxoDisciplinaForm[]): FluxoPipelineStage[] {
  return colunas(disciplinas).map((ordem) => ({
    key: String(ordem),
    titulo: String(ordem),
    nodes: disciplinas
      .filter((d) => d.ordem === ordem)
      .map((d) => {
        const dias = duracaoEfetiva(d);
        const resp = responsaveisEfetivos(d);
        return {
          key: d._key,
          titulo: d.nome,
          status: "nao_iniciado" as const,
          responsavelNome: resp.nomes.length ? resp.nomes.join(", ") : undefined,
          metaLabel: dias ? `${dias} dias úteis` : undefined,
          checklistLabel: d.checklist_padrao?.length ? `${d.checklist_padrao.length} itens` : undefined,
        };
      }),
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
  const [expandedColunas, setExpandedColunas] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resetToList = () => {
    setMode("list");
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEdit = (fluxo: FluxoDisciplinas) => {
    const disc = fluxo.disciplinas.map((d) => ({ ...d, _key: crypto.randomUUID() }));
    setEditingId(fluxo.id);
    setForm({ nome: fluxo.nome, descricao: fluxo.descricao || "", disciplinas: disc });
    setExpandedColunas(colunas(disc).map(String));
    setMode("form");
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setExpandedColunas([]);
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
    if (form.disciplinas.length === 0) {
      toast.error("Adicione pelo menos uma disciplina");
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || undefined,
      disciplinas: form.disciplinas.map(({ _key, ...d }) => d),
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

  const addDisciplina = (ordem: number, nome: string) => {
    const nova: FluxoDisciplinaForm = { ordem, nome, _key: crypto.randomUUID() };
    setForm((prev) => ({ ...prev, disciplinas: [...prev.disciplinas, nova] }));
    setExpandedColunas((prev) => (prev.includes(String(ordem)) ? prev : [...prev, String(ordem)]));
  };

  const addNovaColuna = (nome: string) => {
    const ordens = colunas(form.disciplinas);
    addDisciplina(ordens.length > 0 ? Math.max(...ordens) + 1 : 1, nome);
  };

  const removeDisciplina = (key: string) => {
    setForm((prev) => ({ ...prev, disciplinas: renumerarOrdens(prev.disciplinas.filter((d) => d._key !== key)) }));
  };

  const moveColuna = (ordem: number, direction: "up" | "down") => {
    setForm((prev) => {
      const ordens = colunas(prev.disciplinas);
      const idx = ordens.indexOf(ordem);
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= ordens.length) return prev;
      const targetOrdem = ordens[targetIdx];
      return {
        ...prev,
        disciplinas: prev.disciplinas.map((d) => {
          if (d.ordem === ordem) return { ...d, ordem: targetOrdem };
          if (d.ordem === targetOrdem) return { ...d, ordem };
          return d;
        }),
      };
    });
  };

  const updateDisciplina = (key: string, patch: Partial<FluxoDisciplinaForm>) => {
    setForm((prev) => ({
      ...prev,
      disciplinas: prev.disciplinas.map((d) => (d._key === key ? { ...d, ...patch } : d)),
    }));
  };

  const updateResponsaveis = (key: string, ids: string[]) => {
    const nomes = ids.map((id) => pessoas.find((p) => p.id === id)?.nome).filter((n): n is string => !!n);
    updateDisciplina(key, { responsaveis_ids: ids, responsaveis_nomes: nomes });
  };

  const updateDuracao = (key: string, raw: string) => {
    const parsed = raw.trim() ? parseInt(raw, 10) : NaN;
    const clean = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    updateDisciplina(key, { duracao_dias_uteis: clean });
  };

  const updateChecklist = (key: string, checklist: FluxoChecklistItemTemplate[]) => {
    updateDisciplina(key, { checklist_padrao: checklist });
  };

  const usedNomes = new Set(form.disciplinas.map((d) => d.nome));
  const selecionaveis = disciplinas.filter((d) => !usedNomes.has(d.nome));
  const ordens = colunas(form.disciplinas);
  const previewStages = useMemo(() => buildPreviewStages(form.disciplinas), [form.disciplinas]);

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
                    const fluxoOrdens = colunas(fluxo.disciplinas);
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
                                {fluxoOrdens.length} coluna{fluxoOrdens.length !== 1 ? "s" : ""}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {fluxo.disciplinas.length} disciplina{fluxo.disciplinas.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              {fluxoOrdens.map((ordem, i) => (
                                <div key={ordem} className="flex items-center gap-1">
                                  {i > 0 && <span className="text-muted-foreground text-[10px]">→</span>}
                                  <span className="text-[10px] bg-white border rounded px-1.5 py-0.5">
                                    {fluxo.disciplinas
                                      .filter((d) => d.ordem === ordem)
                                      .map((d) => d.nome)
                                      .join(", ")}
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
                      {ordens.length} coluna{ordens.length !== 1 ? "s" : ""}, {form.disciplinas.length} disciplina
                      {form.disciplinas.length !== 1 ? "s" : ""}
                    </Label>

                    <Accordion
                      type="multiple"
                      value={expandedColunas}
                      onValueChange={setExpandedColunas}
                      className="space-y-3"
                    >
                      {ordens.map((ordem, ordemIdx) => {
                        const discsDaColuna = form.disciplinas.filter((d) => d.ordem === ordem);

                        return (
                          <AccordionItem
                            key={ordem}
                            value={String(ordem)}
                            className="rounded-lg border bg-white overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                              <AccordionTrigger className="p-0 hover:no-underline flex-shrink-0">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-info-soft text-info-strong text-sm font-bold">
                                  {ordem}
                                </span>
                              </AccordionTrigger>
                              <span className="flex-1 text-xs text-muted-foreground">
                                {discsDaColuna.length > 1 ? "Disciplinas em paralelo" : "Disciplina"}
                              </span>
                              <div className="flex gap-0.5 flex-shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={ordemIdx === 0}
                                  onClick={() => moveColuna(ordem, "up")}
                                >
                                  <ArrowUp size={14} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={ordemIdx === ordens.length - 1}
                                  onClick={() => moveColuna(ordem, "down")}
                                >
                                  <ArrowDown size={14} />
                                </Button>
                              </div>
                            </div>

                            <AccordionContent className="px-3">
                              <div className="space-y-2 pt-1">
                                {discsDaColuna.map((disc) => {
                                  const duracaoTravada = (disc.checklist_padrao ?? []).some(
                                    (i) => typeof i.duracao_dias_uteis === "number" && i.duracao_dias_uteis > 0
                                  );
                                  const responsavelTravado = (disc.checklist_padrao ?? []).some(
                                    (i) => (i.responsaveis_ids ?? []).length > 0
                                  );
                                  const efetiva = duracaoEfetiva(disc);
                                  const resp = responsaveisEfetivos(disc);

                                  return (
                                    <div key={disc._key} className="rounded-md border bg-muted/30 p-2.5 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-sm flex-shrink-0">
                                          {disc.nome}
                                        </Badge>
                                        <div className="flex items-center gap-1.5 rounded-full border bg-white px-2.5 h-8 flex-shrink-0">
                                          <Input
                                            type="number"
                                            min={0}
                                            disabled={duracaoTravada}
                                            value={duracaoTravada ? (efetiva ?? "") : (disc.duracao_dias_uteis ?? "")}
                                            onChange={(e) => updateDuracao(disc._key, e.target.value)}
                                            placeholder="—"
                                            title={
                                              duracaoTravada ? "Resolvida pela soma dos dias das tarefas" : undefined
                                            }
                                            className="h-6 w-9 border-none p-0 text-xs text-right shadow-none focus-visible:ring-0 disabled:opacity-100"
                                          />
                                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                                            dias úteis
                                            {duracaoTravada && <Lock className="h-3 w-3" />}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          className="ml-auto text-muted-foreground hover:text-danger-mid flex-shrink-0"
                                          onClick={() => removeDisciplina(disc._key)}
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>

                                      {responsavelTravado ? (
                                        <div
                                          className="flex items-center gap-2 text-[11px] text-muted-foreground"
                                          title="Definidos por tarefa"
                                        >
                                          <AvatarStack pessoas={resp.nomes} size="xs" />
                                          <span className="truncate">{resp.nomes.join(", ")}</span>
                                          <Lock className="h-3 w-3 flex-shrink-0" />
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <SeletorResponsaveis
                                            value={disc.responsaveis_ids ?? []}
                                            pessoas={pessoas}
                                            onChange={(ids) => updateResponsaveis(disc._key, ids)}
                                          />
                                          <p className="text-[10px] text-muted-foreground">
                                            Usado se nenhuma tarefa tiver responsável
                                          </p>
                                        </div>
                                      )}

                                      <div className="border-t pt-2">
                                        <Label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                                          <ListChecks className="h-3 w-3" /> Tarefas (responsável e dias úteis por
                                          tarefa)
                                        </Label>
                                        <TarefasEditor
                                          value={disc.checklist_padrao ?? []}
                                          onChange={(next) => updateChecklist(disc._key, next)}
                                          pessoas={pessoas}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}

                                {selecionaveis.length > 0 && (
                                  <Select onValueChange={(val) => addDisciplina(ordem, val)} value="">
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="+ disciplina em paralelo aqui" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {selecionaveis.map((d) => (
                                        <SelectItem key={d.id} value={d.nome} className="text-sm">
                                          {d.nome}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                    {selecionaveis.length > 0 && (
                      <Select onValueChange={(val) => addNovaColuna(val)} value="">
                        <SelectTrigger className="h-9 text-sm w-full border-dashed">
                          <SelectValue placeholder="+ próxima coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          {selecionaveis.map((d) => (
                            <SelectItem key={d.id} value={d.nome} className="text-sm">
                              {d.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={38} minSize={25}>
                  <div className="flex h-full flex-col bg-muted/20">
                    <div className="flex-shrink-0 border-b px-4 py-3">
                      <Label className="text-xs font-semibold text-muted-foreground">Prévia ao vivo</Label>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto p-4">
                      {previewStages.length === 0 || form.disciplinas.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground px-6">
                          <GitBranch className="h-8 w-8 opacity-30" />
                          <p className="text-xs max-w-[200px]">Adicione disciplinas para ver o fluxo montado aqui</p>
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

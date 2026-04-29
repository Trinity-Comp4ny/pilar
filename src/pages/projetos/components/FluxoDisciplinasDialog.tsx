import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { useFluxosDisciplinas, useCreateFluxo, useUpdateFluxo, useDeleteFluxo } from "@/hooks/useFluxosDisciplinas";
import type { FluxoDisciplinas, FluxoEtapa } from "@/types/fluxoDisciplinas";
import { Plus, Trash2, Edit, ArrowUp, ArrowDown, X, ArrowLeft, GitBranch, Layers, User } from "lucide-react";

interface FluxoDisciplinasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplinas: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
}

interface FluxoFormState {
  nome: string;
  descricao: string;
  etapas: FluxoEtapa[];
}

const emptyForm: FluxoFormState = { nome: "", descricao: "", etapas: [] };

export function FluxoDisciplinasDialog({ open, onOpenChange, disciplinas, pessoas }: FluxoDisciplinasDialogProps) {
  const { data: fluxos = [] } = useFluxosDisciplinas();
  const createFluxo = useCreateFluxo();
  const updateFluxo = useUpdateFluxo();
  const deleteFluxo = useDeleteFluxo();

  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FluxoFormState>(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resetToList = () => {
    setMode("list");
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEdit = (fluxo: FluxoDisciplinas) => {
    setEditingId(fluxo.id);
    setForm({
      nome: fluxo.nome,
      descricao: fluxo.descricao || "",
      etapas: fluxo.etapas.map((e) => ({
        ...e,
        disciplinas: e.disciplinas.map((d) => ({ ...d })),
      })),
    });
    setMode("form");
  };

  const handleNew = () => {
    setEditingId(null);
    setForm({ nome: "", descricao: "", etapas: [{ ordem: 1, nome: "Etapa 1", disciplinas: [] }] });
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
      etapas: form.etapas.map((e, i) => ({ ...e, ordem: i + 1 })),
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
    setForm((prev) => ({
      ...prev,
      etapas: [
        ...prev.etapas,
        { ordem: prev.etapas.length + 1, nome: `Etapa ${prev.etapas.length + 1}`, disciplinas: [] },
      ],
    }));
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

  const usedDisciplinas = new Set(form.etapas.flatMap((e) => e.disciplinas.map((d) => d.nome)));
  const totalDisciplinas = form.etapas.reduce((sum, e) => sum + e.disciplinas.length, 0);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) resetToList();
          onOpenChange(v);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              {mode === "list" ? "Fluxos de Disciplinas" : editingId ? "Editar Fluxo" : "Novo Fluxo"}
            </DialogTitle>
          </DialogHeader>

          {mode === "list" ? (
            <div className="space-y-4 mt-2">
              <Button onClick={handleNew} className="w-full" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Novo Fluxo
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
                        className="bg-gray-50 rounded-lg p-3 border hover:border-gray-300 transition-colors"
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
                              className="h-7 w-7 p-0 text-blue-500"
                              onClick={() => handleEdit(fluxo)}
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500"
                              onClick={() => setConfirmDeleteId(fluxo.id)}
                            >
                              <Trash2 size={14} />
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
            <div className="space-y-4 mt-2">
              <Button variant="ghost" size="sm" className="text-xs -ml-2" onClick={resetToList}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Voltar
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome do Fluxo *</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Fluxo Residencial"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={form.descricao}
                    onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Opcional"
                    className="h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block">
                  Etapas ({form.etapas.length}) — {totalDisciplinas} disciplina{totalDisciplinas !== 1 ? "s" : ""}
                </Label>

                <div className="space-y-3">
                  {form.etapas.map((etapa, etapaIdx) => {
                    const selectableDisciplinas = disciplinas
                      .filter((d) => !usedDisciplinas.has(d.nome) || etapa.disciplinas.some((ed) => ed.nome === d.nome))
                      .filter((d) => !etapa.disciplinas.some((ed) => ed.nome === d.nome));

                    return (
                      <div key={etapaIdx} className="border rounded-lg p-3 bg-white space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">
                            {etapaIdx + 1}
                          </span>
                          <Input
                            value={etapa.nome}
                            onChange={(e) => updateEtapaNome(etapaIdx, e.target.value)}
                            placeholder="Nome da etapa"
                            className="h-7 text-xs flex-1"
                          />
                          <div className="flex gap-0.5 flex-shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={etapaIdx === 0}
                              onClick={() => moveEtapa(etapaIdx, "up")}
                            >
                              <ArrowUp size={12} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={etapaIdx === form.etapas.length - 1}
                              onClick={() => moveEtapa(etapaIdx, "down")}
                            >
                              <ArrowDown size={12} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => removeEtapa(etapaIdx)}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>

                        {/* Disciplinas com responsável */}
                        <div className="space-y-1.5">
                          {etapa.disciplinas.map((disc, discIdx) => (
                            <div key={discIdx} className="flex items-center gap-1.5 bg-gray-50 rounded px-2 py-1">
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {disc.nome}
                              </Badge>
                              <Select
                                value={disc.responsavel_id || ""}
                                onValueChange={(val) => updateDisciplinaResponsavel(etapaIdx, discIdx, val)}
                              >
                                <SelectTrigger className="h-6 text-[10px] flex-1 min-w-[120px]">
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
                                    <SelectItem key={p.id} value={p.id} className="text-xs">
                                      {p.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                type="button"
                                className="hover:bg-gray-300 rounded-full p-0.5 flex-shrink-0"
                                onClick={() => removeDisciplinaFromEtapa(etapaIdx, discIdx)}
                              >
                                <X size={12} className="text-red-500" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {selectableDisciplinas.length > 0 && (
                          <Select onValueChange={(val) => addDisciplinaToEtapa(etapaIdx, val)} value="">
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Adicionar disciplina..." />
                            </SelectTrigger>
                            <SelectContent>
                              {selectableDisciplinas.map((d) => (
                                <SelectItem key={d.id} value={d.nome} className="text-xs">
                                  {d.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {etapa.disciplinas.length > 1 && (
                          <p className="text-[10px] text-muted-foreground">Disciplinas nesta etapa rodam em paralelo</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button type="button" variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={addEtapa}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar Etapa
                </Button>
              </div>

              {/* Preview */}
              {form.etapas.length > 0 && form.etapas.some((e) => e.disciplinas.length > 0) && (
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <Label className="text-[10px] text-muted-foreground mb-2 block">Prévia do fluxo</Label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {form.etapas.map((etapa, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
                        <div className="bg-white border rounded-md px-2 py-1">
                          <span className="text-[10px] font-medium text-blue-700">{etapa.nome}</span>
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {etapa.disciplinas.map((d, di) => (
                              <span key={di} className="text-[9px] bg-blue-50 text-blue-600 rounded px-1 py-0.5">
                                {d.nome}
                                {d.responsavel_nome ? ` (${d.responsavel_nome})` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  className="flex-1"
                  disabled={createFluxo.isPending || updateFluxo.isPending}
                >
                  {editingId ? "Salvar Alterações" : "Criar Fluxo"}
                </Button>
                <Button variant="outline" onClick={resetToList}>
                  Cancelar
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

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePessoasEmpresa } from "@/pages/meu-trabalho/hooks";
import { useUpdateFrente, useDeleteFrente, type ObraFrenteRow } from "@/hooks/useObraFrentes";
import {
  useObraTarefas,
  useCreateObraTarefa,
  useUpdateObraTarefa,
  useDeleteObraTarefa,
  type ObraTarefa,
} from "@/hooks/useObraTarefas";

const SEM_RESP = "__none__";
type PessoaOpcao = { id: string; nome: string };

interface NovaTarefaInput {
  titulo: string;
  responsavel_id: string | null;
  data_inicio: string | null;
  prazo: string | null;
}

function AddTarefaForm({
  pessoas,
  onAdd,
}: {
  pessoas: PessoaOpcao[];
  onAdd: (input: NovaTarefaInput) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [resp, setResp] = useState(SEM_RESP);
  const [inicio, setInicio] = useState("");
  const [prazo, setPrazo] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!titulo.trim()) return;
    if (inicio && prazo && prazo < inicio) {
      toast.error("O início não pode ser depois do prazo");
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        titulo: titulo.trim(),
        responsavel_id: resp === SEM_RESP ? null : resp,
        data_inicio: inicio || null,
        prazo: prazo || null,
      });
      setTitulo("");
      setResp(SEM_RESP);
      setInicio("");
      setPrazo("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Nova tarefa…"
          className="h-8 min-w-[10rem] flex-1"
        />
        <Select value={resp} onValueChange={setResp}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_RESP}>Sem responsável</SelectItem>
            {pessoas.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          value={inicio}
          onChange={setInicio}
          placeholder="Início"
          className="h-8 w-36"
          maxDate={prazo || undefined}
        />
        <DatePicker
          value={prazo}
          onChange={setPrazo}
          placeholder="Prazo"
          className="h-8 w-36"
          minDate={inicio || undefined}
        />
        <Button variant="outline" size="sm" onClick={submit} disabled={saving || !titulo.trim()} className="ml-auto">
          <Plus className="mr-1 h-4 w-4" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function TarefaRow({
  tarefa,
  canEdit,
  onToggle,
  onDelete,
  onUpdateDatas,
}: {
  tarefa: ObraTarefa;
  canEdit: boolean;
  onToggle: (concluida: boolean) => void;
  onDelete: () => void;
  onUpdateDatas: (campos: { data_inicio?: string | null; prazo?: string | null }) => void;
}) {
  const concluida = tarefa.status === "concluida";

  const salvarInicio = (valor: string) => {
    if (valor && tarefa.prazo && tarefa.prazo < valor) {
      toast.error("O início não pode ser depois do prazo");
      return;
    }
    onUpdateDatas({ data_inicio: valor || null });
  };

  const salvarPrazo = (valor: string) => {
    if (valor && tarefa.data_inicio && valor < tarefa.data_inicio) {
      toast.error("O prazo não pode ser antes do início");
      return;
    }
    onUpdateDatas({ prazo: valor || null });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <Checkbox checked={concluida} disabled={!canEdit} onCheckedChange={(v) => onToggle(v === true)} />
      <span
        className={
          concluida
            ? "min-w-[7rem] flex-1 text-sm text-muted-foreground line-through"
            : "min-w-[7rem] flex-1 text-sm text-ink"
        }
      >
        {tarefa.titulo}
      </span>
      {tarefa.responsavel?.nome && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          {tarefa.responsavel.nome}
        </span>
      )}
      {canEdit ? (
        <div className="flex items-center gap-1">
          <DatePicker
            value={tarefa.data_inicio ?? ""}
            onChange={salvarInicio}
            placeholder="Início"
            className="h-7 w-32 text-xs"
            maxDate={tarefa.prazo ?? undefined}
          />
          <span className="text-xs text-muted-foreground">→</span>
          <DatePicker
            value={tarefa.prazo ?? ""}
            onChange={salvarPrazo}
            placeholder="Prazo"
            className="h-7 w-32 text-xs"
            minDate={tarefa.data_inicio ?? undefined}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        (tarefa.data_inicio || tarefa.prazo) && (
          <span className="text-xs text-muted-foreground">
            {tarefa.data_inicio ?? "?"} → {tarefa.prazo ?? "?"}
          </span>
        )
      )}
    </div>
  );
}

/**
 * Detalhe de uma etapa (frente de serviço): suas tarefas (o checklist) e, quando
 * é uma etapa de verdade (não o balde "sem etapa"), a edição das datas do
 * cronograma e a exclusão. `frente = null` mostra as tarefas sem etapa.
 */
export function FrenteDetailDialog({
  open,
  onOpenChange,
  obraId,
  projetoId,
  frente,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  projetoId: string | null;
  frente: ObraFrenteRow | null;
  canEdit: boolean;
}) {
  const { data: tarefas = [] } = useObraTarefas(obraId);
  const { data: pessoas = [] } = usePessoasEmpresa();
  const createTarefa = useCreateObraTarefa(obraId, projetoId);
  const updateTarefa = useUpdateObraTarefa(obraId);
  const deleteTarefa = useDeleteObraTarefa(obraId);
  const updateFrente = useUpdateFrente(obraId);
  const deleteFrente = useDeleteFrente(obraId);
  const [confirmDel, setConfirmDel] = useState(false);

  const frenteId = frente?.id ?? null;
  const daFrente = tarefas.filter((t) => (t.obra_frente_id ?? null) === frenteId);

  const salvarInicio = (valor: string) => {
    if (!frente) return;
    if (valor && frente.data_fim && frente.data_fim < valor) {
      toast.error("A data de fim não pode ser antes do início");
      return;
    }
    updateFrente.mutate({ id: frente.id, data_inicio: valor || null });
  };

  const salvarFim = (valor: string) => {
    if (!frente) return;
    if (valor && frente.data_inicio && valor < frente.data_inicio) {
      toast.error("A data de fim não pode ser antes do início");
      return;
    }
    updateFrente.mutate({ id: frente.id, data_fim: valor || null });
  };

  const addTarefa = async (input: NovaTarefaInput) => {
    try {
      await createTarefa.mutateAsync({ ...input, obra_frente_id: frenteId });
    } catch (e) {
      toast.error("Não foi possível adicionar", { description: e instanceof Error ? e.message : "Tente novamente" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{frente ? frente.nome : "Tarefas sem etapa"}</DialogTitle>
        </DialogHeader>

        {frente && (
          <div className="flex flex-wrap items-end gap-3 border-b border-black/5 pb-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Início da etapa</Label>
              <DatePicker
                value={frente.data_inicio ?? ""}
                onChange={salvarInicio}
                placeholder="Início"
                disabled={!canEdit}
                className="h-8 w-40"
                maxDate={frente.data_fim ?? undefined}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fim da etapa</Label>
              <DatePicker
                value={frente.data_fim ?? ""}
                onChange={salvarFim}
                placeholder="Fim"
                disabled={!canEdit}
                className="h-8 w-40"
                minDate={frente.data_inicio ?? undefined}
              />
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={() => setConfirmDel(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Excluir etapa
              </Button>
            )}
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto">
          {daFrente.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma tarefa ainda.</p>
          ) : (
            <div className="divide-y divide-black/5">
              {daFrente.map((t) => (
                <TarefaRow
                  key={t.id}
                  tarefa={t}
                  canEdit={canEdit}
                  onToggle={(c) => updateTarefa.mutate({ id: t.id, status: c ? "concluida" : "a_fazer" })}
                  onDelete={() => deleteTarefa.mutate(t.id)}
                  onUpdateDatas={(campos) => updateTarefa.mutate({ id: t.id, ...campos })}
                />
              ))}
            </div>
          )}
        </div>

        {canEdit && <AddTarefaForm pessoas={pessoas} onAdd={addTarefa} />}

        <ConfirmDialog
          open={confirmDel}
          onOpenChange={setConfirmDel}
          onConfirm={async () => {
            if (!frente) return;
            try {
              await deleteFrente.mutateAsync(frente.id);
              setConfirmDel(false);
              onOpenChange(false);
            } catch (e) {
              toast.error("Não foi possível remover", {
                description: e instanceof Error ? e.message : "Tente novamente",
              });
            }
          }}
          title="Excluir etapa?"
          itemName={frente?.nome}
          description="As tarefas desta etapa continuam na obra, sem etapa."
          variant="destructive"
          confirmText="Excluir"
          loading={deleteFrente.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

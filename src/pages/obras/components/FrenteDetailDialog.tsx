import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/format";
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

function AddTarefaForm({
  pessoas,
  onAdd,
}: {
  pessoas: PessoaOpcao[];
  onAdd: (input: { titulo: string; responsavel_id: string | null; prazo: string | null }) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [resp, setResp] = useState(SEM_RESP);
  const [prazo, setPrazo] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      await onAdd({ titulo: titulo.trim(), responsavel_id: resp === SEM_RESP ? null : resp, prazo: prazo || null });
      setTitulo("");
      setResp(SEM_RESP);
      setPrazo("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Nova pendência…"
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
      <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-8 w-36" />
      <Button variant="outline" size="sm" onClick={submit} disabled={saving || !titulo.trim()}>
        <Plus className="mr-1 h-4 w-4" />
        Adicionar
      </Button>
    </div>
  );
}

function TarefaRow({
  tarefa,
  canEdit,
  onToggle,
  onDelete,
}: {
  tarefa: ObraTarefa;
  canEdit: boolean;
  onToggle: (concluida: boolean) => void;
  onDelete: () => void;
}) {
  const concluida = tarefa.status === "concluida";
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Checkbox checked={concluida} disabled={!canEdit} onCheckedChange={(v) => onToggle(v === true)} />
      <span className={concluida ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm text-ink"}>
        {tarefa.titulo}
      </span>
      {tarefa.responsavel?.nome && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          {tarefa.responsavel.nome}
        </span>
      )}
      {tarefa.prazo && <span className="text-xs text-muted-foreground">{formatDate(tarefa.prazo)}</span>}
      {canEdit && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/**
 * Detalhe de uma frente: as pendências dela (o checklist que era a aba "Frentes")
 * e, quando é uma frente de verdade (não o balde "sem frente"), a edição das datas
 * do cronograma e a exclusão. `frente = null` mostra as pendências sem frente.
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

  const salvarDatas = (campos: { data_inicio?: string | null; data_fim?: string | null }) => {
    if (!frente) return;
    const inicio = campos.data_inicio !== undefined ? campos.data_inicio : frente.data_inicio;
    const fim = campos.data_fim !== undefined ? campos.data_fim : frente.data_fim;
    if (inicio && fim && fim < inicio) {
      toast.error("A data de fim não pode ser antes do início");
      return;
    }
    updateFrente.mutate({ id: frente.id, ...campos });
  };

  const addTarefa = async (input: { titulo: string; responsavel_id: string | null; prazo: string | null }) => {
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
          <DialogTitle>{frente ? frente.nome : "Pendências sem frente"}</DialogTitle>
        </DialogHeader>

        {frente && (
          <div className="flex flex-wrap items-end gap-3 border-b border-black/5 pb-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Início</Label>
              <Input
                type="date"
                value={frente.data_inicio ?? ""}
                disabled={!canEdit}
                onChange={(e) => salvarDatas({ data_inicio: e.target.value || null })}
                className="h-8 w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fim</Label>
              <Input
                type="date"
                value={frente.data_fim ?? ""}
                disabled={!canEdit}
                onChange={(e) => salvarDatas({ data_fim: e.target.value || null })}
                className="h-8 w-40"
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
                Excluir frente
              </Button>
            )}
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto">
          {daFrente.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma pendência ainda.</p>
          ) : (
            <div className="divide-y divide-black/5">
              {daFrente.map((t) => (
                <TarefaRow
                  key={t.id}
                  tarefa={t}
                  canEdit={canEdit}
                  onToggle={(c) => updateTarefa.mutate({ id: t.id, status: c ? "concluida" : "a_fazer" })}
                  onDelete={() => deleteTarefa.mutate(t.id)}
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
          title="Excluir frente?"
          itemName={frente?.nome}
          description="As pendências desta frente continuam na obra, sem frente."
          variant="destructive"
          confirmText="Excluir"
          loading={deleteFrente.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

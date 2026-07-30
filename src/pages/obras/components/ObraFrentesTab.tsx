import { useState } from "react";
import { toast } from "sonner";
import { Layers, Plus, Trash2, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { usePessoasEmpresa } from "@/pages/meu-trabalho/hooks";
import { useObraFrentes, useCreateFrente, useDeleteFrente, type ObraFrenteRow } from "@/hooks/useObraFrentes";
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
      await onAdd({
        titulo: titulo.trim(),
        responsavel_id: resp === SEM_RESP ? null : resp,
        prazo: prazo || null,
      });
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
  onToggle,
  onDelete,
}: {
  tarefa: ObraTarefa;
  onToggle: (concluida: boolean) => void;
  onDelete: () => void;
}) {
  const concluida = tarefa.status === "concluida";
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Checkbox checked={concluida} onCheckedChange={(v) => onToggle(v === true)} />
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
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function ObraFrentesTab({
  obraId,
  projetoId,
  canEdit,
}: {
  obraId: string;
  projetoId: string | null;
  canEdit: boolean;
}) {
  const { data: frentes = [], isLoading } = useObraFrentes(obraId);
  const { data: tarefas = [] } = useObraTarefas(obraId);
  const { data: pessoas = [] } = usePessoasEmpresa();
  const createFrente = useCreateFrente(obraId);
  const deleteFrente = useDeleteFrente(obraId);
  const createTarefa = useCreateObraTarefa(obraId, projetoId);
  const updateTarefa = useUpdateObraTarefa(obraId);
  const deleteTarefa = useDeleteObraTarefa(obraId);

  const [novaFrente, setNovaFrente] = useState("");
  const [confirmFrente, setConfirmFrente] = useState<ObraFrenteRow | null>(null);

  const tarefasDe = (frenteId: string | null) => tarefas.filter((t) => (t.obra_frente_id ?? null) === frenteId);

  const addFrente = async () => {
    if (!novaFrente.trim()) return;
    try {
      await createFrente.mutateAsync({ nome: novaFrente.trim(), ordem: frentes.length });
      setNovaFrente("");
    } catch (e) {
      toast.error("Não foi possível criar a frente", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  };

  const toggle = (id: string, concluida: boolean) =>
    updateTarefa.mutate({ id, status: concluida ? "concluida" : "a_fazer" });

  const addTarefa =
    (frenteId: string | null) =>
    async (input: { titulo: string; responsavel_id: string | null; prazo: string | null }) => {
      try {
        await createTarefa.mutateAsync({ ...input, obra_frente_id: frenteId });
      } catch (e) {
        toast.error("Não foi possível adicionar", {
          description: e instanceof Error ? e.message : "Tente novamente",
        });
      }
    };

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  const semFrente = tarefasDe(null);

  return (
    <div className="space-y-4">
      {frentes.length === 0 && semFrente.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhuma frente ainda"
          description="Organize a obra por frente de serviço (fundação, alvenaria, instalações) e liste as pendências de cada uma."
        />
      ) : (
        <>
          {frentes.map((f) => {
            const daFrente = tarefasDe(f.id);
            const abertas = daFrente.filter((t) => t.status !== "concluida").length;
            return (
              <Card key={f.id} className="rounded-2xl border border-black/5 bg-white">
                <CardContent className="space-y-1 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      {f.nome}
                      <span className="text-xs font-normal text-muted-foreground">
                        {abertas === 0 ? "sem pendências" : `${abertas} aberta${abertas > 1 ? "s" : ""}`}
                      </span>
                    </h3>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmFrente(f)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="divide-y divide-black/5">
                    {daFrente.map((t) => (
                      <TarefaRow
                        key={t.id}
                        tarefa={t}
                        onToggle={(c) => toggle(t.id, c)}
                        onDelete={() => deleteTarefa.mutate(t.id)}
                      />
                    ))}
                  </div>

                  {canEdit && <AddTarefaForm pessoas={pessoas} onAdd={addTarefa(f.id)} />}
                </CardContent>
              </Card>
            );
          })}

          {semFrente.length > 0 && (
            <Card className="rounded-2xl border border-black/5 bg-white">
              <CardContent className="space-y-1 p-4">
                <h3 className="text-sm font-medium text-ink">Sem frente</h3>
                <div className="divide-y divide-black/5">
                  {semFrente.map((t) => (
                    <TarefaRow
                      key={t.id}
                      tarefa={t}
                      onToggle={(c) => toggle(t.id, c)}
                      onDelete={() => deleteTarefa.mutate(t.id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={novaFrente}
            onChange={(e) => setNovaFrente(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFrente()}
            placeholder="Nova frente de serviço…"
            className="h-9 max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={addFrente} disabled={!novaFrente.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Adicionar frente
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmFrente}
        onOpenChange={(v) => !v && setConfirmFrente(null)}
        onConfirm={async () => {
          if (!confirmFrente) return;
          try {
            await deleteFrente.mutateAsync(confirmFrente.id);
            setConfirmFrente(null);
          } catch (e) {
            toast.error("Não foi possível remover", {
              description: e instanceof Error ? e.message : "Tente novamente",
            });
          }
        }}
        title="Excluir frente?"
        itemName={confirmFrente?.nome}
        description="As pendências desta frente continuam na obra, sem frente."
        variant="destructive"
        confirmText="Excluir"
        loading={deleteFrente.isPending}
      />
    </div>
  );
}

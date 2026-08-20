import { useEffect, useState } from "react";
import { Activity, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";

export type StatusSeveridade = "degradado" | "parcial" | "outage";
export type StatusIncidenteStatus = "investigando" | "identificado" | "monitorando" | "resolvido";

export type StatusComponentOption = {
  id: string;
  slug: string;
  nomeExibicao: string;
};

export type ManagedIncidentUpdate = {
  id: string;
  mensagem: string;
  createdAt: string;
};

export type ManagedIncident = {
  id: string;
  titulo: string;
  severidade: StatusSeveridade;
  status: StatusIncidenteStatus;
  createdAt: string;
  componentIds: string[];
  updates: ManagedIncidentUpdate[];
};

export type CreateIncidentPayload = {
  titulo: string;
  severidade: StatusSeveridade;
  componentIds: string[];
};

export type IncidentsManagerProps = {
  components: StatusComponentOption[];
  incidents: ManagedIncident[];
  isCreating?: boolean;
  onCreateIncident: (payload: CreateIncidentPayload) => void;
  onAddUpdate: (incidentId: string, mensagem: string) => void;
  onResolve: (incidentId: string) => void;
};

const SEVERIDADE_OPTIONS: { value: StatusSeveridade; label: string }[] = [
  { value: "degradado", label: "Degradado" },
  { value: "parcial", label: "Parcial" },
  { value: "outage", label: "Fora do ar" },
];

export function IncidentsManager({
  components,
  incidents,
  isCreating = false,
  onCreateIncident,
  onAddUpdate,
  onResolve,
}: IncidentsManagerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<ManagedIncident | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ManagedIncident | null>(null);

  return (
    <Card className="border border-black/5">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity size={20} strokeWidth={1.5} />
            Incidentes
          </CardTitle>
          <CardDescription>Declarados manualmente aqui aparecem em /status pra qualquer visitante.</CardDescription>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)} variant="brand" className="rounded-full">
          <Plus size={16} strokeWidth={1.75} />
          Novo incidente
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {incidents.length === 0 ? (
          <p className="py-8 text-center text-sm text-black/50">Nenhum incidente registrado.</p>
        ) : (
          incidents.map((incident) => {
            const afetados = components.filter((c) => incident.componentIds.includes(c.id));
            return (
              <div key={incident.id} className="rounded-lg border border-black/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{incident.titulo}</p>
                      <StatusBadge domain="status_incidente" status={incident.status} />
                    </div>
                    <p className="mt-1 text-xs text-black/50">
                      {afetados.map((c) => c.nomeExibicao).join(", ") || "Sem componente associado"} ·{" "}
                      {formatDateTime(incident.createdAt)}
                    </p>
                  </div>
                  {incident.status !== "resolvido" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setUpdateTarget(incident)}
                      >
                        Adicionar atualização
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setResolveTarget(incident)}
                      >
                        Marcar resolvido
                      </Button>
                    </div>
                  )}
                </div>
                {incident.updates.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-l-2 border-black/10 pl-3">
                    {incident.updates.map((u) => (
                      <li key={u.id} className="text-xs text-black/70">
                        <span className="text-black/40">{formatDateTime(u.createdAt)}</span> · {u.mensagem}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </CardContent>

      <CreateIncidentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        components={components}
        isSubmitting={isCreating}
        onSubmit={(payload) => {
          onCreateIncident(payload);
          setCreateOpen(false);
        }}
      />

      <AddUpdateDialog
        incident={updateTarget}
        onClose={() => setUpdateTarget(null)}
        onSubmit={(mensagem) => {
          if (updateTarget) onAddUpdate(updateTarget.id, mensagem);
          setUpdateTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!resolveTarget}
        onOpenChange={(open) => {
          if (!open) setResolveTarget(null);
        }}
        onConfirm={() => {
          if (resolveTarget) onResolve(resolveTarget.id);
          setResolveTarget(null);
        }}
        title="Marcar incidente como resolvido"
        description="O(s) componente(s) afetado(s) voltam a operacional, a menos que outro incidente ativo ainda os afete."
        itemName={resolveTarget?.titulo}
        variant="default"
        confirmText="Marcar resolvido"
      />
    </Card>
  );
}

type CreateIncidentDialogProps = {
  open: boolean;
  onClose: () => void;
  components: StatusComponentOption[];
  isSubmitting: boolean;
  onSubmit: (payload: CreateIncidentPayload) => void;
};

function CreateIncidentDialog({ open, onClose, components, isSubmitting, onSubmit }: CreateIncidentDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [severidade, setSeveridade] = useState<StatusSeveridade>("parcial");
  const [componentIds, setComponentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setTitulo("");
      setSeveridade("parcial");
      setComponentIds([]);
    }
  }, [open]);

  const toggleComponent = (id: string) => {
    setComponentIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const canSubmit = titulo.trim().length > 0 && componentIds.length > 0 && !isSubmitting;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Novo incidente"
      size="md"
      isPending={isSubmitting}
      submitDisabled={!canSubmit}
      submitLabel="Criar incidente"
      onSubmit={() => onSubmit({ titulo: titulo.trim(), severidade, componentIds })}
    >
      <div className="space-y-2">
        <Label htmlFor="incident-titulo">Título</Label>
        <Input
          id="incident-titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Financeiro fora do ar"
        />
      </div>

      <div className="space-y-2">
        <Label>Severidade</Label>
        <Select value={severidade} onValueChange={(v) => setSeveridade(v as StatusSeveridade)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEVERIDADE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Componentes afetados</Label>
        <div className="space-y-2">
          {components.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={componentIds.includes(c.id)} onCheckedChange={() => toggleComponent(c.id)} />
              {c.nomeExibicao}
            </label>
          ))}
        </div>
      </div>
    </FormDialog>
  );
}

type AddUpdateDialogProps = {
  incident: ManagedIncident | null;
  onClose: () => void;
  onSubmit: (mensagem: string) => void;
};

function AddUpdateDialog({ incident, onClose, onSubmit }: AddUpdateDialogProps) {
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    if (!incident) setMensagem("");
  }, [incident]);

  return (
    <FormDialog
      open={!!incident}
      onOpenChange={(next) => !next && onClose()}
      title={`Atualizar: ${incident?.titulo ?? ""}`}
      size="sm"
      submitDisabled={mensagem.trim().length === 0}
      submitLabel="Adicionar"
      onSubmit={() => onSubmit(mensagem.trim())}
    >
      <div className="space-y-2">
        <Label htmlFor="incident-update-mensagem">Mensagem</Label>
        <Textarea
          id="incident-update-mensagem"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="O que mudou desde a última atualização?"
          rows={3}
        />
      </div>
    </FormDialog>
  );
}

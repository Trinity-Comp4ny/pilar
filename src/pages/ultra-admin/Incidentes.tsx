import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Plus, Siren } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PilarPage } from "@/components/PilarPage";
import { FormDialog } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/lib/format";
import { getSafeErrorMessage } from "@/lib/safeError";
import { statusLabel } from "@/lib/status";
import {
  KEYS,
  useComponentes,
  useIncidentes,
  type Componente,
  type Incidente,
  type IncidenteStatus,
  type Severidade,
} from "./hooks";
import { estadoDosComponentes, quandoRelativo } from "./lib";
import { EmptyState } from "@/components/EmptyState";

const SEVERIDADES: Array<{ value: Severidade; label: string; ajuda: string }> = [
  { value: "degradado", label: "Lento ou instável", ajuda: "Funciona, mas com lentidão ou erro intermitente." },
  { value: "parcial", label: "Fora do ar em parte", ajuda: "Uma parte do recurso não funciona." },
  { value: "outage", label: "Fora do ar", ajuda: "O recurso não funciona pra ninguém." },
];

const ETAPAS: IncidenteStatus[] = ["investigando", "identificado", "monitorando", "resolvido"];

function duracao(inicio: string, fim: string | null): string {
  const ms = new Date(fim ?? Date.now()).getTime() - new Date(inicio).getTime();
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} dias`;
}

/**
 * Incidentes da status page pública (spec 055, redesenho SPEC 117): estado de
 * cada componente no topo, incidentes abertos com timeline e os resolvidos
 * recolhidos. O que é declarado aqui aparece em /status pra qualquer visitante.
 */
export default function Incidentes() {
  usePageTitle("Incidentes · Ultra admin");
  const qc = useQueryClient();
  const componentesQ = useComponentes();
  const incidentesQ = useIncidentes();
  const [novoAberto, setNovoAberto] = useState(false);
  const [atualizarAlvo, setAtualizarAlvo] = useState<Incidente | null>(null);

  const componentes = useMemo(() => componentesQ.data ?? [], [componentesQ.data]);
  const incidentes = useMemo(() => incidentesQ.data ?? [], [incidentesQ.data]);
  const abertos = incidentes.filter((i) => i.status !== "resolvido");
  const resolvidos = incidentes.filter((i) => i.status === "resolvido");
  const estado = useMemo(
    () =>
      estadoDosComponentes(
        componentes.map((c) => c.id),
        incidentes
      ),
    [componentes, incidentes]
  );
  const afetados = componentes.filter((c) => estado.get(c.id) !== "operacional").length;
  const recarregar = () => qc.invalidateQueries({ queryKey: KEYS.incidentes });

  const criar = useMutation({
    mutationFn: async (input: { titulo: string; severidade: Severidade; componentIds: string[]; mensagem: string }) => {
      const { data, error } = await supabase
        .from("status_incidents")
        .insert({ titulo: input.titulo, severidade: input.severidade })
        .select("id")
        .single();
      if (error || !data) throw error;
      const { error: e2 } = await supabase
        .from("status_incident_components")
        .insert(input.componentIds.map((component_id) => ({ incident_id: data.id, component_id })));
      if (e2) throw e2;
      if (input.mensagem) {
        const { error: e3 } = await supabase
          .from("status_incident_updates")
          .insert({ incident_id: data.id, mensagem: input.mensagem });
        if (e3) throw e3;
      }
    },
    onSuccess: () => {
      toast.success("Incidente publicado na status page");
      setNovoAberto(false);
      void recarregar();
    },
    onError: (err) => toast.error("Não foi possível criar o incidente", { description: getSafeErrorMessage(err) }),
  });

  const atualizar = useMutation({
    mutationFn: async (input: {
      id: string;
      status: IncidenteStatus;
      mensagem: string;
      statusAtual: IncidenteStatus;
    }) => {
      if (input.mensagem) {
        const { error } = await supabase
          .from("status_incident_updates")
          .insert({ incident_id: input.id, mensagem: input.mensagem });
        if (error) throw error;
      }
      if (input.status !== input.statusAtual) {
        const { error } = await supabase
          .from("status_incidents")
          .update({
            status: input.status,
            resolved_at: input.status === "resolvido" ? new Date().toISOString() : null,
          })
          .eq("id", input.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "resolvido" ? "Incidente resolvido" : "Atualização publicada");
      setAtualizarAlvo(null);
      void recarregar();
    },
    onError: (err) => toast.error("Não foi possível atualizar", { description: getSafeErrorMessage(err) }),
  });

  const carregando = componentesQ.isLoading || incidentesQ.isLoading;

  return (
    <PilarPage
      title="Incidentes"
      primaryAction={{ label: "Declarar incidente", onClick: () => setNovoAberto(true), icon: Plus }}
      actions={
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full" asChild>
          <a href="/status" target="_blank" rel="noreferrer">
            Ver status page
            <ExternalLink size={13} />
          </a>
        </Button>
      }
    >
      <Card className="border border-black/5">
        <CardContent className="space-y-4 p-5">
          {carregando ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                {afetados === 0 ? (
                  <>
                    <CheckCircle2 size={18} className="text-positive-strong" />
                    <p className="text-sm font-medium text-ink">Tudo operando normalmente</p>
                  </>
                ) : (
                  <>
                    <Siren size={18} className="text-danger-strong" />
                    <p className="text-sm font-medium text-ink">
                      {afetados} de {componentes.length} componentes com problema
                    </p>
                  </>
                )}
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {componentes.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-black/5 px-3 py-2"
                  >
                    <span className="truncate text-sm text-ink">{c.nome}</span>
                    <StatusBadge domain="status_componente" status={estado.get(c.id) ?? "operacional"} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="abertos-titulo">
        <h2 id="abertos-titulo" className="text-sm font-semibold text-ink">
          Em aberto <span className="font-normal text-ink-muted">({abertos.length})</span>
        </h2>
        {!carregando && abertos.length === 0 && <EmptyState compact title="Nenhum incidente aberto." />}
        {abertos.map((i) => (
          <CardIncidente key={i.id} incidente={i} componentes={componentes} onAtualizar={() => setAtualizarAlvo(i)} />
        ))}
      </section>

      {resolvidos.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1 text-sm font-semibold text-ink">
            Resolvidos <span className="font-normal text-ink-muted">({resolvidos.length})</span>
            <ChevronDown size={14} className="transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            {resolvidos.map((i) => (
              <CardIncidente key={i.id} incidente={i} componentes={componentes} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <NovoIncidenteDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        componentes={componentes}
        isPending={criar.isPending}
        onConfirm={(input) => criar.mutate(input)}
      />
      <AtualizarDialog
        incidente={atualizarAlvo}
        onClose={() => setAtualizarAlvo(null)}
        isPending={atualizar.isPending}
        onConfirm={(status, mensagem) =>
          atualizarAlvo &&
          atualizar.mutate({ id: atualizarAlvo.id, status, mensagem, statusAtual: atualizarAlvo.status })
        }
      />
    </PilarPage>
  );
}

function CardIncidente({
  incidente: i,
  componentes,
  onAtualizar,
}: {
  incidente: Incidente;
  componentes: Componente[];
  onAtualizar?: () => void;
}) {
  const afetados = componentes.filter((c) => i.componentIds.includes(c.id)).map((c) => c.nome);
  const severidade = SEVERIDADES.find((s) => s.value === i.severidade)?.label ?? i.severidade;
  return (
    <Card className="border border-black/5">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {i.titulo}
            <StatusBadge domain="status_incidente" status={i.status} />
          </CardTitle>
          <p className="text-xs text-ink-muted">
            {severidade} · {afetados.join(", ") || "Sem componente"} · começou {quandoRelativo(i.createdAt)}
            {i.status === "resolvido"
              ? `, durou ${duracao(i.createdAt, i.resolvedAt)}`
              : `, há ${duracao(i.createdAt, null)}`}
          </p>
        </div>
        {onAtualizar && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={onAtualizar}>
            Postar atualização
          </Button>
        )}
      </CardHeader>
      {i.updates.length > 0 && (
        <CardContent>
          <ol className="space-y-2 border-l-2 border-black/10 pl-4">
            {i.updates.map((u) => (
              <li key={u.id} className="text-sm">
                <time className="block text-xs text-ink-muted" dateTime={u.createdAt}>
                  {formatDateTime(u.createdAt)}
                </time>
                <p className="text-ink-soft">{u.mensagem}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

function NovoIncidenteDialog({
  open,
  onOpenChange,
  componentes,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  componentes: Componente[];
  isPending: boolean;
  onConfirm: (input: { titulo: string; severidade: Severidade; componentIds: string[]; mensagem: string }) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [severidade, setSeveridade] = useState<Severidade>("parcial");
  const [ids, setIds] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");
  useEffect(() => {
    if (open) return;
    setTitulo("");
    setSeveridade("parcial");
    setIds([]);
    setMensagem("");
  }, [open]);
  const alternar = (id: string) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Declarar incidente"
      description="Aparece na hora na status page pública."
      size="md"
      submitLabel="Publicar"
      isPending={isPending}
      submitDisabled={!titulo.trim() || ids.length === 0}
      onSubmit={() => onConfirm({ titulo: titulo.trim(), severidade, componentIds: ids, mensagem: mensagem.trim() })}
    >
      <div className="space-y-1.5">
        <Label htmlFor="incidente-titulo">O que está acontecendo</Label>
        <Input
          id="incidente-titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Financeiro lento ao abrir lançamentos"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label>Impacto</Label>
        <Select value={severidade} onValueChange={(v) => setSeveridade(v as Severidade)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEVERIDADES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-ink-muted">{SEVERIDADES.find((s) => s.value === severidade)?.ajuda}</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Componentes afetados</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {componentes.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={ids.includes(c.id)} onCheckedChange={() => alternar(c.id)} />
              {c.nome}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="incidente-mensagem">Primeira atualização (opcional)</Label>
        <Textarea
          id="incidente-mensagem"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Ex.: Estamos investigando a lentidão."
          rows={2}
        />
      </div>
    </FormDialog>
  );
}

function AtualizarDialog({
  incidente,
  onClose,
  isPending,
  onConfirm,
}: {
  incidente: Incidente | null;
  onClose: () => void;
  isPending: boolean;
  onConfirm: (status: IncidenteStatus, mensagem: string) => void;
}) {
  const [status, setStatus] = useState<IncidenteStatus>("investigando");
  const [mensagem, setMensagem] = useState("");
  useEffect(() => {
    if (!incidente) return;
    setStatus(incidente.status);
    setMensagem("");
  }, [incidente]);
  const mudou = !!incidente && status !== incidente.status;

  return (
    <FormDialog
      open={!!incidente}
      onOpenChange={(o) => !o && onClose()}
      title={`Atualizar: ${incidente?.titulo ?? ""}`}
      size="sm"
      submitLabel={status === "resolvido" ? "Resolver" : "Publicar"}
      isPending={isPending}
      submitDisabled={!mudou && !mensagem.trim()}
      onSubmit={() => onConfirm(status, mensagem.trim())}
    >
      <div className="space-y-1.5">
        <Label>Etapa</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as IncidenteStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ETAPAS.map((e) => (
              <SelectItem key={e} value={e}>
                {statusLabel("status_incidente", e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {status === "resolvido" && (
          <p className="text-xs text-ink-muted">
            Os componentes voltam a operacional se nenhum outro incidente os afeta.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="incidente-atualizacao">Mensagem</Label>
        <Textarea
          id="incidente-atualizacao"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="O que mudou desde a última atualização?"
          rows={3}
        />
      </div>
    </FormDialog>
  );
}

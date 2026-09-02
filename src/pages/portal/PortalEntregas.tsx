import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileCheck, CheckCircle2, RotateCcw, FileText, ExternalLink, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reportInvokeError } from "@/lib/monitoring";
import { cn } from "@/lib/utils";
import { getPortalToken } from "@/hooks/useClienteAuth";
import { EmptyState } from "@/components/EmptyState";
import { callUntypedRpc } from "@/lib/supabaseRpc";

interface Entrega {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string | null;
  status: "pendente" | "aprovado" | "revisao_solicitada";
  drive_url: string | null;
  projeto_disciplina_id: string | null;
  disciplina_nome: string | null;
  resposta_cliente: string | null;
  respondido_em: string | null;
  aprovado_ip: string | null;
  aprovado_user_agent: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<Entrega["status"], { label: string; color: string; icon: typeof Clock }> = {
  pendente: { label: "Aguardando resposta", color: "bg-warning-soft text-warning-strong", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-positive/10 text-positive-strong", icon: CheckCircle2 },
  revisao_solicitada: {
    label: "Revisão solicitada",
    color: "bg-attention-soft text-attention-strong",
    icon: RotateCcw,
  },
};

export function EntregasContent({
  projetoId,
  token,
  readOnly,
}: {
  projetoId: string;
  token?: string;
  readOnly?: boolean;
}) {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntregas = useCallback(async () => {
    setLoadError(false);
    try {
      const portalToken = token ?? getPortalToken();
      if (portalToken) {
        // Cliente do portal (auth por token): RLS não alcança, usa RPC por token.
        const { data, error: rpcError } = await callUntypedRpc<Entrega[]>("portal_listar_entregas", {
          p_token: portalToken,
          p_projeto_id: projetoId,
        });
        if (rpcError) throw rpcError;
        if (data) setEntregas(data);
      } else {
        // Staff autenticado (JWT): SELECT direto coberto por RLS.
        const { data, error: fetchError } = await supabase
          .from("portal_entregas")
          .select(
            "id, titulo, descricao, tipo, status, drive_url, projeto_disciplina_id, resposta_cliente, respondido_em, aprovado_ip, aprovado_user_agent, created_at, projeto_disciplinas(nome)"
          )
          .eq("projeto_id", projetoId)
          .order("created_at", { ascending: true });
        if (fetchError) throw fetchError;
        if (data)
          setEntregas(
            (
              data as unknown as (Omit<Entrega, "disciplina_nome"> & {
                projeto_disciplinas: { nome: string } | null;
              })[]
            ).map((d) => ({ ...d, disciplina_nome: d.projeto_disciplinas?.nome ?? null }))
          );
      }
    } catch (err) {
      reportInvokeError(err, "portal-entregas:carregar");
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [projetoId, token]);

  useEffect(() => {
    fetchEntregas();
  }, [fetchEntregas]);

  const handleAprovar = async (id: string) => {
    const portalToken = token ?? getPortalToken();
    if (!portalToken) return;
    setSaving(true);
    const { error } = await callUntypedRpc("portal_aprovar_entrega", {
      p_token: portalToken,
      p_entrega_id: id,
    });
    if (error)
      toast.error("Não foi possível aprovar", {
        description: "Tente novamente em instantes ou fale com o escritório.",
      });
    else toast.success("Entregável aprovado");
    await fetchEntregas();
    setSaving(false);
  };

  const handleSolicitarRevisao = async (id: string) => {
    if (!resposta.trim()) return;
    const portalToken = token ?? getPortalToken();
    if (!portalToken) return;
    setSaving(true);
    const { error } = await callUntypedRpc("portal_solicitar_revisao_entrega", {
      p_token: portalToken,
      p_entrega_id: id,
      p_resposta: resposta.trim(),
    });
    if (error)
      toast.error("Não foi possível enviar a solicitação", {
        description: "Tente novamente em instantes ou fale com o escritório.",
      });
    else toast.success("Solicitação de revisão enviada");
    setRespondingId(null);
    setResposta("");
    await fetchEntregas();
    setSaving(false);
  };

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  if (loadError) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Não foi possível carregar as entregas agora. Atualize a página em instantes ou fale com o escritório se o
          problema continuar.
        </CardContent>
      </Card>
    );
  }

  if (entregas.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState icon={FileText} title="Nenhuma entrega disponível" />
        </CardContent>
      </Card>
    );
  }

  const pendentes = entregas.filter((e) => e.status === "pendente");
  const concluidos = entregas.filter((e) => e.status !== "pendente");

  return (
    <div className="space-y-6">
      {pendentes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-warning-mid" />
            Aguardando sua resposta ({pendentes.length})
          </h3>
          <div className="space-y-3">
            {pendentes.map((e) => (
              <EntregaCard
                key={e.id}
                entrega={e}
                isResponding={respondingId === e.id}
                resposta={resposta}
                setResposta={setResposta}
                onStartRevisao={() => setRespondingId(e.id)}
                onCancelRevisao={() => {
                  setRespondingId(null);
                  setResposta("");
                }}
                onAprovar={() => handleAprovar(e.id)}
                onSolicitar={() => handleSolicitarRevisao(e.id)}
                saving={saving}
                readOnly={readOnly}
              />
            ))}
          </div>
        </section>
      )}

      {concluidos.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Histórico</h3>
          <div className="space-y-2">
            {concluidos.map((e) => (
              <EntregaCard
                key={e.id}
                entrega={e}
                isResponding={false}
                resposta=""
                setResposta={() => undefined}
                onStartRevisao={() => undefined}
                onCancelRevisao={() => undefined}
                onAprovar={() => undefined}
                onSolicitar={() => undefined}
                saving={false}
                readOnly={readOnly}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EntregaCard({
  entrega,
  isResponding,
  resposta,
  setResposta,
  onStartRevisao,
  onCancelRevisao,
  onAprovar,
  onSolicitar,
  saving,
  readOnly,
}: {
  entrega: Entrega;
  isResponding: boolean;
  resposta: string;
  setResposta: (v: string) => void;
  onStartRevisao: () => void;
  onCancelRevisao: () => void;
  onAprovar: () => void;
  onSolicitar: () => void;
  saving: boolean;
  readOnly?: boolean;
}) {
  const config = STATUS_CONFIG[entrega.status];
  const StatusIcon = config.icon;

  return (
    <Card className={cn(entrega.status === "pendente" && "border-warning-mid-border")}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{entrega.titulo}</p>
              {entrega.disciplina_nome && (
                <Badge variant="secondary" className="text-[10px]" title="Etapa do projeto">
                  {entrega.disciplina_nome}
                </Badge>
              )}
            </div>
            {entrega.descricao && <p className="text-xs text-muted-foreground mt-1">{entrega.descricao}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
              <span>{new Date(entrega.created_at).toLocaleDateString("pt-BR")}</span>
              {entrega.drive_url && (
                <a
                  href={entrega.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-info-strong hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir no Drive
                </a>
              )}
            </div>
          </div>
          <Badge className={cn("text-[10px] border flex-shrink-0", config.color)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>

        {entrega.resposta_cliente && (
          <div className="rounded p-2 bg-attention-soft border border-attention-soft-border text-[11px] text-attention-strong">
            <span className="font-medium">Solicitação do cliente:</span> {entrega.resposta_cliente}
          </div>
        )}

        {readOnly && entrega.status === "aprovado" && entrega.respondido_em && (
          <p className="text-[10px] text-muted-foreground">
            Aprovado em {new Date(entrega.respondido_em).toLocaleString("pt-BR")}
            {entrega.aprovado_ip ? ` · IP ${entrega.aprovado_ip}` : ""}
          </p>
        )}

        {!readOnly && entrega.status === "pendente" && (
          <div className="pt-2 border-t">
            {isResponding ? (
              <div className="space-y-2 pt-2">
                <Textarea
                  value={resposta}
                  onChange={(ev) => setResposta(ev.target.value)}
                  placeholder="Descreva o que precisa ser revisado..."
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={onCancelRevisao}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-11 sm:h-9"
                    onClick={onSolicitar}
                    disabled={saving || !resposta.trim()}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Solicitar revisão
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap pt-2">
                <Button
                  size="sm"
                  variant="brand"
                  className="h-11 sm:h-9 bg-positive hover:bg-positive/90"
                  onClick={onAprovar}
                  disabled={saving}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={onStartRevisao}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Solicitar revisão
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

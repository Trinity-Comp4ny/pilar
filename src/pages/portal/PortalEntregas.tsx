import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  FileCheck,
  CheckCircle2,
  RotateCcw,
  FileText,
  Paperclip,
  Download,
  ChevronDown,
  Clock,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPortalToken } from "@/hooks/useClienteAuth";

interface Entrega {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string | null;
  status: "pendente" | "aprovado" | "revisao_solicitada";
  versao: number | null;
  disciplina: string | null;
  fase: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  drive_url: string | null;
  entregavel_pai_id: string | null;
  resposta_cliente: string | null;
  resposta_empresa: string | null;
  respondido_em: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<Entrega["status"], { label: string; color: string; icon: typeof Clock }> = {
  pendente: { label: "Aguardando resposta", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-positive/10 text-positive", icon: CheckCircle2 },
  revisao_solicitada: { label: "Revisão solicitada", color: "bg-orange-100 text-orange-800", icon: RotateCcw },
};

export function EntregasContent({ projetoId, token }: { projetoId: string; token?: string }) {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntregas = useCallback(async () => {
    const { data } = await supabase
      .from("portal_entregas")
      .select(
        "id, titulo, descricao, tipo, status, versao, disciplina, fase, arquivo_path, arquivo_nome, drive_url, entregavel_pai_id, resposta_cliente, resposta_empresa, respondido_em, created_at"
      )
      .eq("projeto_id", projetoId)
      .order("created_at", { ascending: true });
    if (data) setEntregas(data as unknown as Entrega[]);
    setLoading(false);
  }, [projetoId]);

  useEffect(() => {
    fetchEntregas();
  }, [fetchEntregas]);

  const threads = useMemo(() => buildThreads(entregas), [entregas]);

  const handleAprovar = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("portal_entregas")
      .update({ status: "aprovado", respondido_em: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Erro ao aprovar");
    else toast.success("Entregável aprovado");
    await fetchEntregas();
    setSaving(false);
  };

  const handleSolicitarRevisao = async (id: string) => {
    if (!resposta.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("portal_entregas")
      .update({
        status: "revisao_solicitada",
        resposta_cliente: resposta.trim(),
        respondido_em: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) toast.error("Erro ao enviar solicitação");
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

  if (threads.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma entrega disponível.</p>
        </CardContent>
      </Card>
    );
  }

  const pendentes = threads.filter((t) => t.current.status === "pendente");
  const concluidos = threads.filter((t) => t.current.status !== "pendente");

  return (
    <div className="space-y-6">
      {pendentes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-yellow-600" />
            Aguardando sua resposta ({pendentes.length})
          </h3>
          <div className="space-y-3">
            {pendentes.map((thread) => (
              <ThreadPortalCard
                key={thread.root.id}
                thread={thread}
                token={token}
                expanded={expandedId === thread.root.id}
                onToggle={() => setExpandedId((prev) => (prev === thread.root.id ? null : thread.root.id))}
                isResponding={respondingId === thread.current.id}
                resposta={resposta}
                setResposta={setResposta}
                onStartRevisao={() => setRespondingId(thread.current.id)}
                onCancelRevisao={() => {
                  setRespondingId(null);
                  setResposta("");
                }}
                onAprovar={() => handleAprovar(thread.current.id)}
                onSolicitar={() => handleSolicitarRevisao(thread.current.id)}
                saving={saving}
              />
            ))}
          </div>
        </section>
      )}

      {concluidos.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Histórico</h3>
          <div className="space-y-2">
            {concluidos.map((thread) => (
              <ThreadPortalCard
                key={thread.root.id}
                thread={thread}
                token={token}
                expanded={expandedId === thread.root.id}
                onToggle={() => setExpandedId((prev) => (prev === thread.root.id ? null : thread.root.id))}
                isResponding={false}
                resposta=""
                setResposta={() => undefined}
                onStartRevisao={() => undefined}
                onCancelRevisao={() => undefined}
                onAprovar={() => undefined}
                onSolicitar={() => undefined}
                saving={false}
                historico
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type Thread = { root: Entrega; versoes: Entrega[]; current: Entrega };

function buildThreads(entregas: Entrega[]): Thread[] {
  const byId = new Map<string, Entrega>(entregas.map((e) => [e.id, e]));
  const threadsMap = new Map<string, { root: Entrega; versoes: Entrega[] }>();

  for (const e of entregas) {
    let rootId = e.id;
    let current: Entrega | undefined = e;
    while (current?.entregavel_pai_id) {
      const parent = byId.get(current.entregavel_pai_id);
      if (!parent) break;
      rootId = parent.id;
      current = parent;
    }
    if (!threadsMap.has(rootId)) {
      threadsMap.set(rootId, { root: byId.get(rootId)!, versoes: [] });
    }
    threadsMap.get(rootId)!.versoes.push(e);
  }

  return Array.from(threadsMap.values())
    .map(({ root, versoes }) => {
      versoes.sort((a, b) => (a.versao ?? 1) - (b.versao ?? 1));
      return { root, versoes, current: versoes[versoes.length - 1] };
    })
    .sort((a, b) => new Date(b.root.created_at).getTime() - new Date(a.root.created_at).getTime());
}

function ThreadPortalCard({
  thread,
  token,
  expanded,
  onToggle,
  isResponding,
  resposta,
  setResposta,
  onStartRevisao,
  onCancelRevisao,
  onAprovar,
  onSolicitar,
  saving,
  historico,
}: {
  thread: Thread;
  token?: string;
  expanded: boolean;
  onToggle: () => void;
  isResponding: boolean;
  resposta: string;
  setResposta: (v: string) => void;
  onStartRevisao: () => void;
  onCancelRevisao: () => void;
  onAprovar: () => void;
  onSolicitar: () => void;
  saving: boolean;
  historico?: boolean;
}) {
  const current = thread.current;
  const config = STATUS_CONFIG[current.status];
  const StatusIcon = config.icon;
  const hasHistory = thread.versoes.length > 1;

  return (
    <Card className={cn(!historico && current.status === "pendente" && "border-yellow-200")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3 cursor-pointer" onClick={onToggle}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{current.titulo}</p>
              {current.disciplina && (
                <Badge variant="secondary" className="text-[10px]">
                  {current.disciplina}
                </Badge>
              )}
              {(current.versao ?? 1) > 1 && (
                <Badge variant="outline" className="text-[10px]">
                  v{current.versao}
                </Badge>
              )}
            </div>
            {current.descricao && !expanded && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{current.descricao}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
              <span>{new Date(current.created_at).toLocaleDateString("pt-BR")}</span>
              {current.fase && <span>· {current.fase}</span>}
              {current.arquivo_nome && (
                <span className="flex items-center gap-1">
                  · <Paperclip className="h-3 w-3" /> {current.arquivo_nome}
                </span>
              )}
              {current.drive_url && (
                <span className="flex items-center gap-1 text-blue-700">
                  · <ExternalLink className="h-3 w-3" /> Google Drive
                </span>
              )}
              {hasHistory && <span>· {thread.versoes.length} versões</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={cn("text-[10px] border", config.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            <ChevronDown
              className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
            />
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {thread.versoes.map((v) => (
              <VersionBlock key={v.id} entrega={v} isLatest={v.id === current.id} token={token} />
            ))}
          </div>
        )}

        {!historico && current.status === "pendente" && (
          <div className="mt-3 pt-3 border-t">
            {isResponding ? (
              <div className="space-y-2">
                <Textarea
                  value={resposta}
                  onChange={(ev) => setResposta(ev.target.value)}
                  placeholder="Descreva o que precisa ser revisado..."
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={onCancelRevisao}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={onSolicitar} disabled={saving || !resposta.trim()}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Solicitar revisão
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" className="bg-positive hover:bg-positive/90" onClick={onAprovar} disabled={saving}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={onStartRevisao}>
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

function VersionBlock({ entrega, isLatest, token }: { entrega: Entrega; isLatest: boolean; token?: string }) {
  const config = STATUS_CONFIG[entrega.status];

  return (
    <div className={cn("rounded-md p-3 bg-muted/30 border text-xs space-y-2", !isLatest && "opacity-70")}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            v{entrega.versao ?? 1}
          </Badge>
          <Badge className={cn("text-[10px] border", config.color)}>{config.label}</Badge>
          <span className="text-muted-foreground">{new Date(entrega.created_at).toLocaleDateString("pt-BR")}</span>
        </div>
        <div className="flex items-center gap-2">
          {entrega.drive_url && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7 text-[11px] border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <a href={entrega.drive_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                <span className="ml-1">Abrir no Drive</span>
              </a>
            </Button>
          )}
          {entrega.arquivo_path && (
            <PortalDownloadButton
              entregaId={entrega.id}
              path={entrega.arquivo_path}
              nome={entrega.arquivo_nome}
              token={token}
            />
          )}
        </div>
      </div>

      {entrega.descricao && <p className="text-foreground">{entrega.descricao}</p>}

      {entrega.resposta_empresa && (
        <div className="rounded p-2 bg-blue-50 border border-blue-100 text-[11px] text-blue-900">
          <span className="font-medium">Observação do escritório:</span> {entrega.resposta_empresa}
        </div>
      )}

      {entrega.resposta_cliente && (
        <div className="rounded p-2 bg-orange-50 border border-orange-100 text-[11px] text-orange-900">
          <span className="font-medium">Sua solicitação:</span> {entrega.resposta_cliente}
        </div>
      )}
    </div>
  );
}

function PortalDownloadButton({
  entregaId,
  path,
  nome,
  token,
}: {
  entregaId: string;
  path: string;
  nome: string | null;
  token?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let signedUrl: string | undefined;
      const sessionToken = getPortalToken();

      if (token) {
        const { data, error } = await supabase.functions.invoke("portal-entrega-download", {
          body: { token, entrega_id: entregaId },
        });
        if (error) throw error;
        signedUrl = (data as { signed_url?: string })?.signed_url;
      } else if (sessionToken) {
        const { data, error } = await supabase.functions.invoke("portal-entrega-download", {
          body: { session_token: sessionToken, entrega_id: entregaId },
        });
        if (error) throw error;
        signedUrl = (data as { signed_url?: string })?.signed_url;
      } else {
        // Fallback: admin interno com JWT autenticado (fluxo inexistente aqui, mas seguro)
        const { data, error } = await supabase.storage.from("portal-entregas").createSignedUrl(path, 300);
        if (error) throw error;
        signedUrl = data?.signedUrl;
      }

      if (!signedUrl) throw new Error("Link não gerado");
      const link = document.createElement("a");
      link.href = signedUrl;
      link.download = nome || "entregavel";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Não foi possível baixar o arquivo");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleDownload} disabled={downloading}>
      {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      <span className="ml-1">Baixar</span>
    </Button>
  );
}

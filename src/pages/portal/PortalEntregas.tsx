import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileCheck, CheckCircle2, RotateCcw, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "./PortalShell";

interface Entrega {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string | null;
  status: string;
  resposta_cliente: string | null;
  respondido_em: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-800" },
  revisao_solicitada: { label: "Revisão Solicitada", color: "bg-orange-100 text-orange-800" },
};

export default function PortalEntregas() {
  return <PortalShell>{(data) => <EntregasContent projetoId={data.projeto_id} />}</PortalShell>;
}

function EntregasContent({ projetoId }: { projetoId: string }) {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntregas = async () => {
    const { data } = await supabase
      .from("portal_entregas")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("created_at", { ascending: false });
    if (data) setEntregas(data as Entrega[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntregas();
  }, [projetoId]);

  const handleAprovar = async (id: string) => {
    setSaving(true);
    await supabase
      .from("portal_entregas")
      .update({ status: "aprovado", respondido_em: new Date().toISOString() })
      .eq("id", id);
    await fetchEntregas();
    setSaving(false);
  };

  const handleSolicitarRevisao = async (id: string) => {
    if (!resposta.trim()) return;
    setSaving(true);
    await supabase
      .from("portal_entregas")
      .update({
        status: "revisao_solicitada",
        resposta_cliente: resposta.trim(),
        respondido_em: new Date().toISOString(),
      })
      .eq("id", id);
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

  const pendentes = entregas.filter((e) => e.status === "pendente");
  const respondidas = entregas.filter((e) => e.status !== "pendente");

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-6">
      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-yellow-600" />
            Aguardando sua resposta ({pendentes.length})
          </h3>
          <div className="space-y-3">
            {pendentes.map((e) => (
              <Card key={e.id} className="border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{e.titulo}</p>
                      {e.descricao && <p className="text-xs text-muted-foreground mt-1">{e.descricao}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {e.tipo && (
                          <Badge variant="secondary" className="text-[10px]">
                            {e.tipo}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">{formatDate(e.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {respondingId === e.id ? (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <Textarea
                        value={resposta}
                        onChange={(ev) => setResposta(ev.target.value)}
                        placeholder="Descreva o que precisa ser revisado..."
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRespondingId(null);
                            setResposta("");
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleSolicitarRevisao(e.id)}
                          disabled={saving || !resposta.trim()}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" /> Solicitar Revisão
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleAprovar(e.id)}
                        disabled={saving}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRespondingId(e.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Solicitar Revisão
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Respondidas */}
      {respondidas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Histórico</h3>
          <div className="space-y-2">
            {respondidas.map((e) => {
              const config = STATUS_CONFIG[e.status] || STATUS_CONFIG.pendente;
              return (
                <Card key={e.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{e.titulo}</p>
                        {e.descricao && <p className="text-xs text-muted-foreground">{e.descricao}</p>}
                        {e.resposta_cliente && (
                          <p className="text-xs mt-1 p-2 bg-orange-50 rounded text-orange-800">
                            Sua resposta: {e.resposta_cliente}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge className={`text-[10px] ${config.color}`}>{config.label}</Badge>
                        {e.respondido_em && (
                          <p className="text-[10px] text-muted-foreground mt-1">{formatDate(e.respondido_em)}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {entregas.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma entrega disponível.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

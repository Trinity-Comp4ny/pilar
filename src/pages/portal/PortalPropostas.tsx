import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ThumbsUp, ThumbsDown, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "./PortalShell";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Proposta {
  id: string;
  codigo: string | null;
  titulo: string;
  valor_proposto: number | null;
  prazo_estimado_dias: number | null;
  localizacao: string | null;
  area_m2: number | null;
  validade: string | null;
  status: string;
  observacao: string | null;
  created_at: string;
}

function formatMoeda(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    enviada: "bg-blue-100 text-blue-800",
    aceita: "bg-green-100 text-green-800",
    recusada: "bg-red-100 text-red-800",
    expirada: "bg-gray-100 text-gray-600",
  };
  const label: Record<string, string> = {
    enviada: "Aguardando resposta",
    aceita: "Aceita",
    recusada: "Recusada",
    expirada: "Expirada",
  };
  return <Badge className={`text-xs ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{label[status] ?? status}</Badge>;
}

function PropostasContent({ token }: { token: string }) {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.rpc("get_portal_propostas", { p_token: token });
      if (!error && data) setPropostas(data as Proposta[]);
      setLoading(false);
    };
    fetch();
  }, [token]);

  const handleResponder = async (propostaId: string, status: "aceita" | "recusada") => {
    setResponding(propostaId + status);
    try {
      const { error } = await supabase.rpc("portal_atualizar_status_proposta", {
        p_token: token,
        p_proposta_id: propostaId,
        p_status: status,
      });
      if (error) throw error;
      setPropostas((prev) => prev.map((p) => (p.id === propostaId ? { ...p, status } : p)));
      toast.success(status === "aceita" ? "Proposta aceita!" : "Proposta recusada.");
    } catch {
      toast.error("Erro ao responder proposta.");
    } finally {
      setResponding(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (propostas.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
          Nenhuma proposta disponível no momento.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {propostas.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {p.codigo ? `${p.codigo} — ` : ""}
                  {p.titulo}
                </p>
                {p.localizacao && <p className="text-xs text-muted-foreground mt-0.5">{p.localizacao}</p>}
              </div>
              <StatusBadge status={p.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Valor</p>
                <p className="font-medium">{formatMoeda(p.valor_proposto)}</p>
              </div>
              {p.prazo_estimado_dias != null && (
                <div>
                  <p className="text-muted-foreground">Prazo</p>
                  <p className="font-medium">{p.prazo_estimado_dias} dias</p>
                </div>
              )}
              {p.area_m2 != null && (
                <div>
                  <p className="text-muted-foreground">Área</p>
                  <p className="font-medium">{p.area_m2} m²</p>
                </div>
              )}
              {p.validade && (
                <div>
                  <p className="text-muted-foreground">Validade</p>
                  <p className="font-medium">{formatData(p.validade)}</p>
                </div>
              )}
            </div>

            {p.observacao && <p className="text-xs text-muted-foreground border-t pt-2">{p.observacao}</p>}

            {p.status === "enviada" && (
              <div className="flex gap-2 pt-1 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-500 text-green-700 hover:bg-green-50"
                  disabled={responding !== null}
                  onClick={() => handleResponder(p.id, "aceita")}
                >
                  {responding === p.id + "aceita" ? (
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                  ) : (
                    <ThumbsUp size={14} className="mr-1.5" />
                  )}
                  Aceitar proposta
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  disabled={responding !== null}
                  onClick={() => handleResponder(p.id, "recusada")}
                >
                  {responding === p.id + "recusada" ? (
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                  ) : (
                    <ThumbsDown size={14} className="mr-1.5" />
                  )}
                  Recusar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PortalPropostas() {
  usePageTitle("Portal | Propostas");
  return <PortalShell>{(_, token) => <PropostasContent token={token} />}</PortalShell>;
}

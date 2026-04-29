import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileCheck, Clock, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PendenciasCardProps {
  projetoId: string;
  baseUrl: string; // ex: "/cliente/projeto/:id" ou "/portal/:token"
}

interface Pendencias {
  entregasPendentes: number;
  faturasProximasVencimento: number;
  faturasAtrasadas: number;
}

export function PendenciasCard({ projetoId, baseUrl }: PendenciasCardProps) {
  const navigate = useNavigate();
  const [pendencias, setPendencias] = useState<Pendencias | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const hoje = new Date();
      const em7dias = new Date(hoje);
      em7dias.setDate(em7dias.getDate() + 7);
      const hojeIso = hoje.toISOString().split("T")[0];
      const em7diasIso = em7dias.toISOString().split("T")[0];

      const [entregasRes, receitasRes] = await Promise.all([
        supabase
          .from("portal_entregas")
          .select("id", { count: "exact", head: true })
          .eq("projeto_id", projetoId)
          .eq("status", "pendente"),
        supabase
          .from("receitas")
          .select("id, data_vencimento, status")
          .eq("projeto_id", projetoId)
          .neq("status", "Recebido")
          .is("deleted_at", null)
          .lte("data_vencimento", em7diasIso),
      ]);

      const receitas = receitasRes.data ?? [];
      const atrasadas = receitas.filter((r) => (r.data_vencimento ?? "") < hojeIso).length;
      const proximasVencimento = receitas.filter((r) => (r.data_vencimento ?? "") >= hojeIso).length;

      setPendencias({
        entregasPendentes: entregasRes.count ?? 0,
        faturasProximasVencimento: proximasVencimento,
        faturasAtrasadas: atrasadas,
      });
      setLoading(false);
    };
    load();
  }, [projetoId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!pendencias) return null;

  const totalPendencias =
    pendencias.entregasPendentes + pendencias.faturasProximasVencimento + pendencias.faturasAtrasadas;

  if (totalPendencias === 0) {
    return (
      <Card className="border-emerald-200/60 bg-emerald-50/30">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
            <FileCheck className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-900">Nada pendente</p>
            <p className="text-xs text-emerald-700/80">Você está em dia com este projeto.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Você tem pendências</p>
            <p className="text-xs text-amber-700/80">{totalPendencias} item(ns) precisa(m) da sua atenção.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {pendencias.entregasPendentes > 0 && (
            <button
              onClick={() => navigate(`${baseUrl}/entregas`)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white hover:bg-amber-50 border border-amber-100 text-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileCheck className="h-3.5 w-3.5 text-amber-700" />
                <span>
                  {pendencias.entregasPendentes} entrega{pendencias.entregasPendentes === 1 ? "" : "s"} para aprovar
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-amber-700" />
            </button>
          )}

          {pendencias.faturasAtrasadas > 0 && (
            <button
              onClick={() => navigate(`${baseUrl}/financeiro`)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white hover:bg-red-50 border border-red-200 text-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-red-700" />
                <span className="text-red-800">
                  {pendencias.faturasAtrasadas} fatura{pendencias.faturasAtrasadas === 1 ? "" : "s"} em atraso
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-red-700" />
            </button>
          )}

          {pendencias.faturasProximasVencimento > 0 && (
            <button
              onClick={() => navigate(`${baseUrl}/financeiro`)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white hover:bg-amber-50 border border-amber-100 text-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-700" />
                <span>
                  {pendencias.faturasProximasVencimento} fatura{pendencias.faturasProximasVencimento === 1 ? "" : "s"}{" "}
                  vencendo em 7 dias
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-amber-700" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface BadgePendenciasProps {
  count: number;
}

export function BadgePendencias({ count }: BadgePendenciasProps) {
  if (count === 0) return null;
  return (
    <Badge className="bg-amber-100 text-amber-800 border-amber-200 border text-[10px]">
      {count} pendente{count === 1 ? "" : "s"}
    </Badge>
  );
}

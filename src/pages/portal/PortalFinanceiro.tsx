import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "./PortalShell";

interface Receita {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_recebimento: string | null;
  status: string;
}

export default function PortalFinanceiro() {
  return (
    <PortalShell>
      {(data) => <FinanceiroContent projetoId={data.projeto_id} />}
    </PortalShell>
  );
}

function FinanceiroContent({ projetoId }: { projetoId: string }) {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("receitas")
        .select("id, descricao, valor, data_vencimento, data_recebimento, status")
        .eq("projeto_id", projetoId)
        .is("deleted_at", null)
        .order("data_vencimento", { ascending: true });
      if (data) setReceitas(data as Receita[]);
      setLoading(false);
    };
    fetch();
  }, [projetoId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const formatDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const totalPrevisto = receitas.reduce((s, r) => s + r.valor, 0);
  const totalRecebido = receitas.filter((r) => r.status === "Recebido").reduce((s, r) => s + r.valor, 0);
  const totalPendente = receitas.filter((r) => r.status === "Pendente").reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Previsto</p>
            <p className="text-lg font-bold">{formatCurrency(totalPrevisto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalRecebido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-lg font-bold text-yellow-600">{formatCurrency(totalPendente)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progresso de pagamento */}
      {totalPrevisto > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso de Pagamento</span>
              <span className="text-sm font-bold">{((totalRecebido / totalPrevisto) * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${(totalRecebido / totalPrevisto) * 100}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de parcelas */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-4">Parcelas</h3>
          {receitas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma parcela registrada.</p>
          ) : (
            <div className="space-y-3">
              {receitas.map((r) => {
                const isRecebido = r.status === "Recebido";
                const isAtrasado = !isRecebido && new Date(r.data_vencimento) < new Date();
                return (
                  <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className={`p-1.5 rounded ${isRecebido ? "bg-green-100 text-green-700" : isAtrasado ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {isRecebido ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{r.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        Vencimento: {formatDate(r.data_vencimento)}
                        {r.data_recebimento && ` · Recebido: ${formatDate(r.data_recebimento)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(r.valor)}</p>
                      <Badge className={`text-[10px] ${isRecebido ? "bg-green-100 text-green-800" : isAtrasado ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {isRecebido ? "Recebido" : isAtrasado ? "Atrasado" : "Pendente"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

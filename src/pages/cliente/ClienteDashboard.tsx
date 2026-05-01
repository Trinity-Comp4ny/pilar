import { Link, useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderKanban, ArrowRight } from "lucide-react";
import { ClienteShell } from "./ClienteShell";
import { useClienteProjetos, type ClienteProjeto } from "./useClienteProjetos";
import type { ClienteAccount } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

const STATUS_COLORS: Record<string, string> = {
  Planejamento: "bg-blue-100 text-blue-800",
  "Em andamento": "bg-positive/10 text-positive",
  Revisão: "bg-purple-100 text-purple-800",
  Paralisado: "bg-yellow-100 text-yellow-800",
  Concluído: "bg-gray-100 text-gray-800",
  Cancelado: "bg-red-100 text-red-800",
};

function calcProgress(disciplinas: ClienteProjeto["disciplinas"]): number {
  if (!Array.isArray(disciplinas) || disciplinas.length === 0) return 0;
  const concluidas = disciplinas.filter((d) => d.status === "Concluído").length;
  return Math.round((concluidas / disciplinas.length) * 100);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function ClienteDashboard() {
  usePageTitle("Portal | Dashboard");
  const account = useOutletContext<ClienteAccount>();
  const { projetos, loading, error } = useClienteProjetos();

  return (
    <ClienteShell account={account}>
      <div className="space-y-6">
        {/* Saudação */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Olá, {account.nome.split(" ")[0]}</h2>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe o andamento dos seus projetos.</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Erro */}
        {error && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-red-600">{error}</CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && !error && projetos.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <FolderKanban className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Nenhum projeto encontrado.</p>
            </CardContent>
          </Card>
        )}

        {/* Grid de projetos */}
        {!loading && projetos.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {projetos.map((projeto) => {
              const progress = calcProgress(projeto.disciplinas);
              const statusColor = STATUS_COLORS[projeto.projeto_status] || "bg-gray-100 text-gray-800";

              return (
                <Link key={projeto.projeto_id} to={`/cliente/projeto/${projeto.projeto_id}`} className="block group">
                  <Card className="h-full transition-all hover:shadow-md hover:border-brand/30 group-hover:border-brand/30">
                    <CardContent className="p-5 space-y-4">
                      {/* Header do card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {projeto.projeto_codigo && (
                            <p className="text-xs text-muted-foreground font-mono">{projeto.projeto_codigo}</p>
                          )}
                          <h3 className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                            {projeto.projeto_nome}
                          </h3>
                        </div>
                        <Badge className={`text-[10px] shrink-0 ${statusColor}`}>{projeto.projeto_status}</Badge>
                      </div>

                      {/* Barra de progresso */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">Progresso</span>
                          <span className="text-xs font-medium">{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-brand h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      {/* Datas */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Início: {formatDate(projeto.data_inicio)}</span>
                        <span>Previsão: {formatDate(projeto.data_previsao)}</span>
                      </div>

                      {/* Link */}
                      <div className="flex items-center gap-1 text-xs font-medium text-brand group-hover:underline">
                        Ver detalhes
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </ClienteShell>
  );
}

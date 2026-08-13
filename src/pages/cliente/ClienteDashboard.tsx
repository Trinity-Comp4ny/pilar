import { Link, useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2, FolderKanban, ArrowRight, Building2 } from "lucide-react";
import { ClienteShell } from "./ClienteShell";
import { useClienteProjetos, type ClienteProjeto } from "./useClienteProjetos";
import { useClienteObras } from "./useClienteObraData";
import type { ClienteAccount } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

// Suporte do Pilar encaminha o cliente ao escritório responsável pela conta.
const SUPORTE_EMAIL = "suporte@pilarsoft.com.br";

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
  const { obras } = useClienteObras();

  return (
    <ClienteShell account={account}>
      <div className="space-y-6">
        {/* Saudação */}
        <div>
          <h1 className="text-xl font-semibold text-ink">Olá, {account.nome.split(" ")[0]}</h1>
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
            <CardContent className="p-6 text-center text-sm text-danger-mid">
              Não foi possível carregar seus projetos agora. Atualize a página em instantes ou fale com o escritório se
              o problema continuar.
            </CardContent>
          </Card>
        )}

        {/* Empty state: só quando não há nada liberado (nem projeto nem obra). */}
        {!loading && !error && projetos.length === 0 && obras.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <FolderKanban className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-ink">Você ainda não tem projetos liberados</p>
              <p className="text-sm text-muted-foreground mt-1">
                Fale com o escritório para liberar seu acesso ou{" "}
                <a
                  href={`mailto:${SUPORTE_EMAIL}?subject=${encodeURIComponent("Liberar acesso ao portal do cliente")}`}
                  className="font-medium text-ink hover:underline"
                >
                  entre em contato com o suporte
                </a>
                .
              </p>
            </CardContent>
          </Card>
        )}

        {/* Grid de projetos */}
        {!loading && projetos.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projetos.map((projeto) => {
              const progress = calcProgress(projeto.disciplinas);

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
                          <h3 className="text-sm font-semibold text-ink truncate mt-0.5">
                            {projeto.projeto_nome}
                          </h3>
                        </div>
                        <StatusBadge domain="projeto" status={projeto.projeto_status} className="text-[10px] shrink-0" />
                      </div>

                      {/* Barra de progresso */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">Etapas concluídas</span>
                          <span className="text-xs font-medium">{progress}%</span>
                        </div>
                        <div
                          className="w-full bg-muted rounded-full h-2"
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Etapas concluídas"
                        >
                          <div className="bg-brand h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      {/* Datas */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Início: {formatDate(projeto.data_inicio)}</span>
                        <span>Previsão: {formatDate(projeto.data_previsao)}</span>
                      </div>

                      <div
                        aria-hidden="true"
                        className="inline-flex items-center gap-1 bg-brand text-ink text-xs font-medium px-3 py-1.5 rounded-lg transition-all group-hover:bg-brand/90"
                      >
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

        {/* Obras liberadas (regime administração) */}
        {obras.length > 0 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Obras</h2>
              <p className="text-xs text-muted-foreground">Acompanhe a execução e a prestação de contas.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {obras.map((obra) => (
                <Link key={obra.id} to={`/cliente/obra/${obra.id}`} className="block group">
                  <Card className="h-full transition-all hover:shadow-md hover:border-brand/30 group-hover:border-brand/30">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <h3 className="text-sm font-semibold text-ink truncate">{obra.nome}</h3>
                        </div>
                        <StatusBadge domain="obra" status={obra.status} className="text-[10px] shrink-0" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">Avanço</span>
                          <span className="text-xs font-medium">{obra.avanco_pct}%</span>
                        </div>
                        <div
                          className="w-full bg-muted rounded-full h-2"
                          role="progressbar"
                          aria-valuenow={obra.avanco_pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Avanço da obra"
                        >
                          <div
                            className="bg-brand h-2 rounded-full transition-all"
                            style={{ width: `${obra.avanco_pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Início: {formatDate(obra.data_inicio_prevista)}</span>
                        <span>Previsão: {formatDate(obra.data_fim_prevista)}</span>
                      </div>
                      <div
                        aria-hidden="true"
                        className="inline-flex items-center gap-1 bg-brand text-ink text-xs font-medium px-3 py-1.5 rounded-lg transition-all group-hover:bg-brand/90"
                      >
                        Ver obra
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </ClienteShell>
  );
}

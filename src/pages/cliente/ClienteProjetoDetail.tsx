import { useParams, useOutletContext, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2 } from "lucide-react";
import { ClienteShell } from "./ClienteShell";
import { useClienteProjetoData } from "./useClienteProjetoData";
import { FinanceiroContent } from "@/pages/portal/PortalFinanceiro";
import { EntregasContent } from "@/pages/portal/PortalEntregas";
import type { ClienteAccount } from "./useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

interface DisciplinaResponsavel {
  data_inicio?: string;
  data_previsao?: string;
  data_final?: string;
}

interface OverviewDisciplina {
  disciplina?: string;
  status?: string;
  data_inicio?: string;
  data_previsao?: string;
  data_final?: string;
  responsaveis?: DisciplinaResponsavel[];
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

/** Extrai datas da disciplina ou do primeiro responsável */
function getDisciplinaDates(d: OverviewDisciplina) {
  const r = d.responsaveis?.[0];
  return {
    inicio: d.data_inicio || r?.data_inicio || "",
    previsao: d.data_previsao || r?.data_previsao || "",
    final: d.data_final || r?.data_final || "",
  };
}

function ProjetoOverview({
  disciplinas,
  dataInicio,
  dataPrevisao,
}: {
  disciplinas: OverviewDisciplina[];
  dataInicio: string | null;
  dataPrevisao: string | null;
}) {
  const total = disciplinas.length;
  const concluidas = disciplinas.filter((d) => d.status === "Concluído").length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Prazos do projeto */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Início do Projeto</p>
            <p className="text-sm font-semibold mt-1">{formatDate(dataInicio)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Previsão de Conclusão</p>
            <p className="text-sm font-semibold mt-1">{formatDate(dataPrevisao)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progresso */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-3">Progresso do Projeto</h3>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div className="bg-accent-orange h-3 rounded-full transition-all" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {progresso}% concluído — {concluidas} de {total} disciplinas
          </p>
        </CardContent>
      </Card>

      {/* Disciplinas */}
      {total > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Disciplinas</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {disciplinas.map((d, i) => {
              const isConcluido = d.status === "Concluído";
              const isAndamento = d.status === "Em Andamento";
              const statusColor = isConcluido
                ? "bg-green-100 text-green-800"
                : isAndamento
                  ? "bg-accent-orange/10 text-accent-orange"
                  : "bg-gray-100 text-gray-600";
              const dotColor = isConcluido ? "bg-green-500" : isAndamento ? "bg-accent-orange" : "bg-gray-300";
              const dates = getDisciplinaDates(d);

              return (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <p className="text-sm font-medium">{d.disciplina}</p>
                      </div>
                      <Badge className={`text-[10px] ${statusColor}`}>{d.status || "Não iniciado"}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {dates.inicio && <span>Início: {formatDate(dates.inicio)}</span>}
                      {dates.previsao && <span>Previsão: {formatDate(dates.previsao)}</span>}
                      {dates.final && <span>Concluído: {formatDate(dates.final)}</span>}
                      {!dates.inicio && !dates.previsao && !dates.final && (
                        <span className="italic">Datas não definidas</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClienteProjetoDetail() {
  const { id } = useParams<{ id: string }>();
  usePageTitle("Portal | Projeto");
  const account = useOutletContext<ClienteAccount>();
  const { data, loading, error } = useClienteProjetoData(id);
  const location = useLocation();

  if (loading) {
    return (
      <ClienteShell account={account} projetoId={id}>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </ClienteShell>
    );
  }

  if (error || !data) {
    return (
      <ClienteShell account={account}>
        <div className="flex justify-center py-12">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <Building2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">Projeto não encontrado</h2>
              <p className="text-sm text-muted-foreground">
                {error || "Não foi possível carregar os dados do projeto."}
              </p>
            </CardContent>
          </Card>
        </div>
      </ClienteShell>
    );
  }

  // Determina qual aba mostrar com base na URL
  const basePath = `/cliente/projeto/${id}`;
  const subPath = location.pathname.replace(basePath, "");

  let content: React.ReactNode;
  if (subPath === "/financeiro") {
    content = <FinanceiroContent projetoId={data.projeto_id} />;
  } else if (subPath === "/entregas") {
    content = <EntregasContent projetoId={data.projeto_id} />;
  } else {
    content = (
      <ProjetoOverview
        disciplinas={Array.isArray(data.disciplinas) ? data.disciplinas : []}
        dataInicio={data.data_inicio}
        dataPrevisao={data.data_previsao}
      />
    );
  }

  return (
    <ClienteShell
      account={account}
      projetoId={data.projeto_id}
      projetoNome={data.projeto_nome}
      projetoCodigo={data.projeto_codigo}
    >
      {content}
    </ClienteShell>
  );
}

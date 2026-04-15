import { useParams, useOutletContext, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2 } from "lucide-react";
import { ClienteShell } from "./ClienteShell";
import { useClienteProjetoData } from "./useClienteProjetoData";
import { TimelineContent } from "@/pages/portal/PortalTimeline";
import { FinanceiroContent } from "@/pages/portal/PortalFinanceiro";
import { EntregasContent } from "@/pages/portal/PortalEntregas";
import type { ClienteAccount } from "./useClienteAuth";

function ProjetoOverview({
  projetoId,
  disciplinas,
}: {
  projetoId: string;
  disciplinas: Array<{ disciplina?: string; status?: string }>;
}) {
  const total = disciplinas.length;
  const concluidas = disciplinas.filter((d) => d.status === "Concluído").length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return (
    <div className="space-y-6">
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
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-3">Etapas</h3>
            <div className="space-y-2">
              {disciplinas.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm">{d.disciplina}</span>
                  <Badge variant={d.status === "Concluído" ? "default" : "secondary"} className="text-xs">
                    {d.status || "Não iniciado"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ClienteProjetoDetail() {
  const { id } = useParams<{ id: string }>();
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
  if (subPath === "/timeline") {
    content = <TimelineContent projetoId={data.projeto_id} />;
  } else if (subPath === "/financeiro") {
    content = <FinanceiroContent projetoId={data.projeto_id} />;
  } else if (subPath === "/entregas") {
    content = <EntregasContent projetoId={data.projeto_id} />;
  } else {
    content = (
      <ProjetoOverview
        projetoId={data.projeto_id}
        disciplinas={Array.isArray(data.disciplinas) ? data.disciplinas : []}
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

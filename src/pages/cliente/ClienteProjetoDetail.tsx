import { useParams, useOutletContext, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";
import { ClienteShell } from "./ClienteShell";
import { useClienteProjetoData } from "./useClienteProjetoData";
import { FinanceiroContent } from "@/pages/portal/PortalFinanceiro";
import { EntregasContent } from "@/pages/portal/PortalEntregas";
import { TimelineContent, type TimelineDisciplina } from "@/pages/portal/PortalTimeline";
import { PendenciasCard } from "@/pages/portal/PendenciasCard";
import type { ClienteAccount } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function ProjetoOverview({
  projetoId,
  dataInicio,
  dataPrevisao,
  disciplinas,
  receitas,
  portalEntregasPendentes,
}: {
  projetoId: string;
  dataInicio: string | null;
  dataPrevisao: string | null;
  disciplinas: TimelineDisciplina[];
  receitas: import("@/pages/cliente/useClienteProjetoData").ClienteReceita[];
  portalEntregasPendentes: number;
}) {
  return (
    <div className="space-y-6">
      <PendenciasCard
        baseUrl={`/cliente/projeto/${projetoId}`}
        receitas={receitas}
        portalEntregasPendentes={portalEntregasPendentes}
      />

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

      <TimelineContent disciplinas={disciplinas} />
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
    content = <FinanceiroContent receitas={data.receitas ?? []} />;
  } else if (subPath === "/entregas") {
    content = <EntregasContent projetoId={data.projeto_id} />;
  } else {
    content = (
      <ProjetoOverview
        projetoId={data.projeto_id}
        dataInicio={data.data_inicio}
        dataPrevisao={data.data_previsao}
        disciplinas={(data.disciplinas as TimelineDisciplina[]) ?? []}
        receitas={data.receitas ?? []}
        portalEntregasPendentes={data.portal_entregas_pendentes ?? 0}
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

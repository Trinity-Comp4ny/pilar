import { useParams, useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";
import { ClienteShell } from "./ClienteShell";
import { useClienteObraData, type ClienteObraFrente } from "./useClienteObraData";
import { usePortalObraFotos } from "./usePortalObraFotos";
import { TimelineContent, type TimelineDisciplina } from "@/pages/portal/PortalTimeline";
import { ContaObraContent } from "@/pages/portal/PortalContaObra";
import { RdoFeedCard } from "@/pages/obras/components/RdoFeedCard";
import { EmptyState } from "@/components/EmptyState";
import { estadoFrenteCronograma, type EstadoFrente } from "@/lib/obras";
import type { ClienteAccount } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

function formatDate(d: string | null | undefined): string {
  if (!d) return "A definir";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

// Traduz o estado calculado da frente (obras.ts) para o vocabulário do
// TimelineContent, que conta "Concluído" no progresso e destaca "Em andamento".
const ESTADO_LABEL: Record<EstadoFrente, string> = {
  concluida: "Concluído",
  em_andamento: "Em andamento",
  atrasada: "Atrasada",
  futura: "Não iniciado",
  sem_prazo: "Sem prazo",
};

function frentesParaTimeline(frentes: ClienteObraFrente[]): TimelineDisciplina[] {
  return frentes.map((f) => ({
    disciplina: f.nome,
    status: ESTADO_LABEL[estadoFrenteCronograma(f, f.tarefas)],
    data_inicio: f.data_inicio ?? undefined,
    data_previsao: f.data_fim ?? undefined,
  }));
}

export default function ClienteObraDetail() {
  const { id } = useParams<{ id: string }>();
  usePageTitle("Portal | Obra");
  const account = useOutletContext<ClienteAccount>();
  const { data, loading, error } = useClienteObraData(id);
  const fotoIds = (data?.diario ?? []).flatMap((d) => d.fotos.map((f) => f.id));
  const { data: urlPorFoto = {} } = usePortalObraFotos(fotoIds);

  if (loading) {
    return (
      <ClienteShell account={account} obraNome="Obra">
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
              <h2 className="text-lg font-semibold mb-2">Obra não encontrada</h2>
              <p className="text-sm text-muted-foreground">{error || "Não foi possível carregar os dados da obra."}</p>
            </CardContent>
          </Card>
        </div>
      </ClienteShell>
    );
  }

  return (
    <ClienteShell account={account} obraNome={data.nome}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Início previsto</p>
              <p className="text-sm font-semibold mt-1">{formatDate(data.data_inicio_prevista)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Previsão de conclusão</p>
              <p className="text-sm font-semibold mt-1">{formatDate(data.data_fim_prevista)}</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3">Andamento da obra</h2>
          <TimelineContent disciplinas={frentesParaTimeline(data.frentes)} />
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3">Prestação de contas</h2>
          <ContaObraContent conta={data.conta} taxaPct={data.taxa_administracao_pct} />
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3">Diário</h2>
          {data.diario.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nenhum registro ainda"
              description="Assim que a equipe lançar o dia, ele aparece aqui."
            />
          ) : (
            <div className="mx-auto max-w-xl">
              {data.diario.map((dia, i) => (
                <RdoFeedCard
                  key={dia.id}
                  data={dia.data}
                  clima={dia.clima}
                  atividades={dia.atividades}
                  fotos={dia.fotos.flatMap((f) => {
                    const url = urlPorFoto[f.id];
                    return url ? [{ id: f.id, url }] : [];
                  })}
                  ultimo={i === data.diario.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ClienteShell>
  );
}

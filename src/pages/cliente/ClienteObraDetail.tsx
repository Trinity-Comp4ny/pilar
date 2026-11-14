import { useParams, useOutletContext, useSearchParams } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/components/SectionTabs";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { ClienteShell } from "./ClienteShell";
import { useClienteObraData } from "./useClienteObraData";
import { usePortalObraFotos, usePortalRegistroFotos, usePortalResumoSemana } from "./usePortalObraFotos";
import { RegistrosPortal } from "./RegistrosPortal";
import { CronogramaObraContent, ResumoFrentes } from "./PortalCronogramaObra";
import { ContaObraContent } from "@/pages/portal/PortalContaObra";
import { EntregasContent } from "@/components/portal/PortalEntregas";
import { RdoFeedCard } from "@/pages/obras/components/RdoFeedCard";
import { EmptyState } from "@/components/EmptyState";
import type { ClienteAccount } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

import { ReadingRing } from "@/components/motion/ReadingRing";

function formatDate(d: string | null | undefined): string {
  if (!d) return "A definir";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

const ABAS_OBRA: SectionTab[] = [
  { id: "geral", label: "Visão geral" },
  { id: "cronograma", label: "Cronograma" },
  { id: "rdo", label: "RDO" },
  { id: "financeiro", label: "Financeiro" },
];
type Aba = "geral" | "cronograma" | "rdo" | "financeiro";

export default function ClienteObraDetail() {
  const { id } = useParams<{ id: string }>();
  usePageTitle("Portal | Obra");
  const account = useOutletContext<ClienteAccount>();
  const { data, loading, error } = useClienteObraData(id);
  const [params, setParams] = useSearchParams();
  const abaParam = params.get("aba");
  const aba = (ABAS_OBRA.find((a) => a.id === abaParam)?.id ?? "geral") as Aba;
  const fotoIds = (data?.diario ?? []).flatMap((d) => d.fotos.map((f) => f.id));
  const { data: urlPorFoto = {} } = usePortalObraFotos(fotoIds);
  const registros = data?.registros ?? [];
  const resumoSemana = usePortalResumoSemana(id, registros.length > 0);
  const { data: fotosPorRegistro = {} } = usePortalRegistroFotos(
    registros.filter((r) => r.num_fotos > 0).map((r) => r.id)
  );

  if (loading) {
    return (
      <ClienteShell account={account} obraNome="Obra">
        <div className="flex justify-center py-12">
          <ReadingRing size={64} />
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
        <SectionTabs
          tabs={ABAS_OBRA}
          value={aba}
          onValueChange={(v) => setParams(v === "geral" ? {} : { aba: v }, { replace: true })}
          ariaLabel="Seções da obra"
        />
        {aba === "geral" && (
          <div className="space-y-6">
            <EntregasContent obraId={data.obra_id} apenasPendentes />

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

            <ResumoFrentes frentes={data.frentes} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard label="Aportado pelo cliente" value={data.conta.total_aportado} tone="neutral" />
              <KPICard label="Gasto na obra" value={data.conta.total_gasto} tone="warning" />
              <KPICard
                label="Saldo em conta"
                value={data.conta.saldo}
                tone={data.conta.saldo < 0 ? "danger" : "positive"}
              />
            </div>
          </div>
        )}

        {aba === "cronograma" && (
          <div className="">
            <CronogramaObraContent frentes={data.frentes} />
          </div>
        )}

        {aba === "rdo" && (
          <div className="space-y-6">
            <RegistrosPortal
              registros={registros}
              fotosPorRegistro={fotosPorRegistro}
              resumo={{ carregando: resumoSemana.isLoading, texto: resumoSemana.data ?? null }}
            />

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
        )}

        {aba === "financeiro" && (
          <div className="">
            <h2 className="text-sm font-semibold mb-3">Prestação de contas</h2>
            <ContaObraContent conta={data.conta} taxaPct={data.taxa_administracao_pct} />
          </div>
        )}
      </div>
    </ClienteShell>
  );
}

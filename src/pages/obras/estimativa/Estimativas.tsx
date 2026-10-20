import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, Plus } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PilarPage } from "@/components/PilarPage";
import { StatusBadge } from "@/components/StatusBadge";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { SUBTIPOS } from "@/schemas/estimativaObra";
import { toDataSourceResult } from "@/types/dataSource";
import { useEstimativas, type EstimativaResumo } from "./hooks";
import { rotuloPadrao } from "@/lib/estimativaObra";

function descricaoDaObra(e: EstimativaResumo): string {
  if (!e.ficha) return "Ficha fora do formato";
  const subtipo = SUBTIPOS[e.ficha.tipo][e.ficha.subtipo]?.nome ?? e.ficha.subtipo;
  return `${subtipo} · padrão ${rotuloPadrao(e.ficha.padrao)}`;
}

const COLUNAS: ColumnDef<EstimativaResumo>[] = [
  {
    key: "nome",
    header: "Estimativa",
    getSortValue: (e) => e.nome.toLowerCase(),
    cell: (e) => <span className="font-medium text-ink">{e.nome}</span>,
    mobile: "title",
  },
  {
    key: "cliente",
    header: "Cliente",
    getSortValue: (e) => (e.clienteNome ?? "").toLowerCase(),
    cell: (e) => e.clienteNome ?? <span className="text-ink-soft">Sem cliente</span>,
    mobile: "subtitle",
  },
  { key: "obra", header: "Obra", cell: descricaoDaObra },
  {
    key: "area",
    header: "Área",
    align: "end",
    getSortValue: (e) => e.ficha?.area ?? 0,
    cell: (e) => (e.ficha ? `${e.ficha.area.toLocaleString("pt-BR")} m²` : "-"),
    className: "tabular-nums",
  },
  {
    key: "provavel",
    header: "Provável",
    align: "end",
    getSortValue: (e) => e.resultado?.provavel ?? 0,
    cell: (e) => (e.resultado ? formatCurrency(e.resultado.provavel, { decimals: 0 }) : "-"),
    className: "tabular-nums",
    mobile: "trailing",
  },
  {
    key: "versao",
    header: "Versão",
    align: "end",
    getSortValue: (e) => e.versaoAtual,
    cell: (e) => (e.versaoAtual > 0 ? `v${e.versaoAtual}` : <span className="text-ink-soft">sem versão</span>),
    className: "tabular-nums",
  },
  {
    key: "status",
    header: "Status",
    cell: (e) => <StatusBadge domain="estimativa_obra" status={e.status} />,
    mobile: "badge",
  },
  {
    key: "atualizada",
    header: "Atualizada",
    getSortValue: (e) => e.atualizadoEm,
    cell: (e) => <span className="text-ink-soft">{formatDateTime(e.atualizadoEm)}</span>,
  },
];

/** Lista das estimativas da empresa (SPEC 136). Cada linha abre o resultado. */
export default function Estimativas() {
  usePageTitle("Estimativas de obra");
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [busca, setBusca] = useState("");
  const query = useEstimativas();
  const podeCriar = can("estimativa_obra", "create");

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const todas = query.data ?? [];
    if (!q) return todas;
    return todas.filter((e) => e.nome.toLowerCase().includes(q) || (e.clienteNome ?? "").toLowerCase().includes(q));
  }, [query.data, busca]);

  const nova = () => navigate("/obras/estimativas/nova");
  const vazio = !query.isLoading && !query.error && (query.data ?? []).length === 0;

  return (
    <PilarPage
      title="Estimativas"
      search={{ value: busca, onChange: setBusca, placeholder: "Buscar estimativa ou cliente" }}
      primaryAction={{ label: "Nova estimativa", onClick: nova, icon: Plus, feature: "estimativa_obra" }}
    >
      {vazio ? (
        <EmptyState
          icon={Calculator}
          iconTone="brand"
          title="Estime a primeira obra"
          description="Descreva a obra do seu cliente e receba em poucos minutos uma faixa de custo, com fonte de preço, e um cronograma pronto para ajustar."
          action={podeCriar ? { label: "Nova estimativa", onClick: nova, variant: "brand" } : undefined}
        />
      ) : (
        <DataTable
          columns={COLUNAS}
          data={toDataSourceResult<EstimativaResumo>({
            data: visiveis,
            isLoading: query.isLoading,
            error: query.error,
          })}
          rowKey={(e) => e.id}
          onRowClick={(e) => navigate(`/obras/estimativas/${e.id}`)}
          rowLabel={(e) => `Abrir a estimativa ${e.nome}`}
          defaultSortKey="atualizada"
          defaultSortDir="desc"
        />
      )}
    </PilarPage>
  );
}

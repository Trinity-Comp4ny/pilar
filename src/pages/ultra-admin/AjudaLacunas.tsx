import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PilarPage } from "@/components/PilarPage";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import { formatDateTime } from "@/lib/format";
import { usePageTitle } from "@/hooks/usePageTitle";
import { agruparLacunas, type LacunaAgrupada } from "./ajudaLacunasLib";

const DIAS = 30;

// Lacunas da central de ajuda (SPEC 155): o que perguntaram ao agente da ajuda ou buscaram na
// central sem achar resposta, nos últimos 30 dias. Cada linha é candidata a artigo novo.
export default function AjudaLacunas() {
  usePageTitle("Ajuda · Ultra admin");
  const query = useQuery({
    queryKey: ["ultra-admin-ajuda-lacunas"],
    queryFn: async () => {
      const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("ajuda_perguntas_sem_resposta")
        .select("texto, rota, origem, empresa_id, created_at")
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const linhas = useMemo(() => agruparLacunas(query.data ?? []), [query.data]);

  const columns: ColumnDef<LacunaAgrupada>[] = [
    { key: "texto", header: "Pergunta", cell: (l) => <span className="text-ink">{l.texto}</span> },
    { key: "vezes", header: "Vezes", align: "end", getSortValue: (l) => l.vezes, cell: (l) => l.vezes },
    {
      key: "escritorios",
      header: "Escritórios",
      align: "end",
      getSortValue: (l) => l.escritorios,
      cell: (l) => l.escritorios,
    },
    {
      key: "telas",
      header: "Telas",
      cell: (l) => <span className="text-xs text-ink-muted">{l.telas.join(", ")}</span>,
    },
    {
      key: "ultima",
      header: "Última vez",
      getSortValue: (l) => l.ultima,
      cell: (l) => <span className="text-ink-muted">{formatDateTime(l.ultima)}</span>,
    },
  ];

  return (
    <PilarPage title="Lacunas da ajuda">
      <p className="text-sm text-ink-muted">
        Perguntas ao agente da ajuda e buscas na central sem resposta, nos últimos {DIAS} dias. As mais repetidas são os
        próximos artigos a escrever em <code>src/content/ajuda</code>.
      </p>
      <DataTable
        columns={columns}
        data={toDataSourceResult<LacunaAgrupada>({ data: linhas, isLoading: query.isLoading, error: query.error })}
        rowKey={(l) => l.texto}
        emptyMessage="Nenhuma pergunta sem resposta nos últimos 30 dias."
        errorTitle="Não foi possível carregar as perguntas"
      />
    </PilarPage>
  );
}

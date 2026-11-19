import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { EmptyState } from "@/components/EmptyState";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ORIGENS_CONTATO, TIPOS_REUNIAO } from "./cerebroLib";
import { NovaReuniaoDialog } from "./NovaReuniaoDialog";
import { useReunioes, type Reuniao } from "./reunioesApi";

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  analisada: { label: "Analisada", variant: "success" },
  pendente: { label: "Pendente", variant: "warning" },
  falhou: { label: "Falhou", variant: "danger" },
};

/** Reuniões coladas no Ultra (SPEC 169, fase 1): lista e "Nova reunião". */
export default function Reunioes() {
  usePageTitle("Reuniões · Ultra admin");
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const query = useReunioes();

  const colunas: ColumnDef<Reuniao>[] = [
    {
      key: "titulo",
      header: "Reunião",
      mobile: "title",
      getSortValue: (r) => r.titulo,
      cell: (r) => <span className="font-medium">{r.titulo}</span>,
    },
    {
      key: "data",
      header: "Data",
      mobile: "subtitle",
      getSortValue: (r) => r.ocorreu_em,
      cell: (r) => formatDate(r.ocorreu_em.slice(0, 10)),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (r) => TIPOS_REUNIAO[r.tipo_corrigido ?? r.tipo] ?? r.tipo,
    },
    {
      key: "origem",
      header: "Origem",
      cell: (r) => (r.origem_contato ? ORIGENS_CONTATO[r.origem_contato] : "Sem origem"),
    },
    {
      key: "status",
      header: "Status",
      mobile: "badge",
      cell: (r) => {
        const s = STATUS[r.status] ?? STATUS.pendente;
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
  ];

  return (
    <PilarPage
      title="Reuniões"
      actions={
        <Button variant="brand" size="sm" onClick={() => setAberto(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova reunião
        </Button>
      }
    >
      <p className="text-sm text-ink-muted">
        Cole a transcrição de uma reunião para extrair dores, ideias e objeções, cada uma com a citação do texto.
      </p>
      <DataTable
        columns={colunas}
        data={{ rows: query.data ?? [], isPending: query.isPending, error: query.error as Error | null }}
        rowKey={(r) => r.id}
        rowLabel={(r) => `Abrir a reunião ${r.titulo}`}
        onRowClick={(r) => navigate(`/ultra-admin/reunioes/${r.id}`)}
        defaultSortKey="data"
        defaultSortDir="desc"
        emptyState={
          <EmptyState
            title="Nenhuma reunião ainda"
            description="Cole a primeira transcrição para começar."
            action={{ label: "Nova reunião", onClick: () => setAberto(true), variant: "brand" }}
          />
        }
      />
      <NovaReuniaoDialog
        open={aberto}
        onOpenChange={setAberto}
        onAnalisada={(id) => navigate(`/ultra-admin/reunioes/${id}`)}
      />
    </PilarPage>
  );
}

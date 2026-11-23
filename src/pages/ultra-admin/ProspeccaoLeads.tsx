import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { useLeads, useRegistrarEnvio, type ProspecLead, type ResultadoEnvio } from "./prospeccaoApi";
import { formatarTelefone, ROTULO_CANAL, ROTULO_STATUS, SEGMENTOS } from "./prospeccaoLib";

const TODOS = "todos";

const TOM_STATUS: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  novo: "neutral",
  fila: "info",
  enviado: "info",
  respondeu: "success",
  reuniao_marcada: "success",
  sem_interesse: "warning",
  numero_errado: "warning",
  parar: "danger",
};

/** Resultados que o fundador marca depois do envio, direto na lista. */
const RESULTADOS_POSTERIORES: Array<{ value: ResultadoEnvio; label: string }> = [
  { value: "respondeu", label: "Respondeu" },
  { value: "reuniao_marcada", label: "Reunião marcada" },
  { value: "sem_interesse", label: "Sem interesse" },
  { value: "parar", label: "Não contatar" },
];

function ResultadoCell({ lead }: { lead: ProspecLead }) {
  const registrar = useRegistrarEnvio();
  const marcavel = ["enviado", "respondeu", "reuniao_marcada", "sem_interesse"].includes(lead.status);
  if (!marcavel) {
    return <Badge variant={TOM_STATUS[lead.status] ?? "neutral"}>{ROTULO_STATUS[lead.status] ?? lead.status}</Badge>;
  }
  return (
    <Select
      value={lead.status === "enviado" ? undefined : lead.status}
      disabled={registrar.isPending}
      onValueChange={(v) =>
        registrar.mutate(
          { leadId: lead.id, resultado: v as ResultadoEnvio },
          { onError: (e: Error) => toast.error(e.message) }
        )
      }
    >
      <SelectTrigger className="h-8 w-44" aria-label={`Resultado de ${lead.nome}`}>
        <SelectValue placeholder="Enviado: marcar resultado" />
      </SelectTrigger>
      <SelectContent>
        {RESULTADOS_POSTERIORES.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Aba Leads: a base inteira, com busca e filtro por status. */
export function ProspeccaoLeads() {
  const query = useLeads();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState(TODOS);

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (query.data ?? []).filter(
      (l) =>
        (status === TODOS || l.status === status) &&
        (!t || l.nome.toLowerCase().includes(t) || (l.cidade ?? "").toLowerCase().includes(t))
    );
  }, [query.data, busca, status]);

  const colunas: ColumnDef<ProspecLead>[] = [
    {
      key: "nome",
      header: "Empresa",
      mobile: "title",
      getSortValue: (l) => l.nome,
      cell: (l) => <span className="font-medium">{l.nome}</span>,
    },
    {
      key: "cidade",
      header: "Cidade",
      mobile: "subtitle",
      getSortValue: (l) => l.cidade ?? "",
      cell: (l) => l.cidade ?? "",
    },
    {
      key: "segmento",
      header: "Segmento",
      getSortValue: (l) => l.segmento,
      cell: (l) => (
        <span className="flex items-center gap-2">
          {SEGMENTOS[l.segmento]?.rotulo ?? l.segmento}
          {l.segmento_teste && <Badge variant="info">Teste</Badge>}
        </span>
      ),
    },
    { key: "canal", header: "Canal", cell: (l) => ROTULO_CANAL[l.canal] },
    { key: "telefone", header: "Telefone", cell: (l) => formatarTelefone(l.telefone_e164) },
    { key: "nota", header: "Nota", getSortValue: (l) => l.nota_encaixe, cell: (l) => l.nota_encaixe },
    {
      key: "status",
      header: "Status",
      mobile: "badge",
      getSortValue: (l) => l.status,
      cell: (l) => <ResultadoCell lead={l} />,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por empresa ou cidade"
          aria-label="Buscar leads"
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            {Object.entries(ROTULO_STATUS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={colunas}
        data={{ rows: linhas, isPending: query.isPending, error: query.error as Error | null }}
        rowKey={(l) => l.id}
        defaultSortKey="nota"
        defaultSortDir="desc"
        emptyState={<EmptyState title="Nenhum lead" description="Importe a base ou ajuste o filtro." />}
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { usePageTitle } from "@/hooks/usePageTitle";
import { statusLabel } from "@/lib/status";
import { toDataSourceResult } from "@/types/dataSource";
import { toast } from "sonner";
import { PLAN_LABEL, edgeFetch, type EmpresaRow } from "./api";
import { useAcaoEmpresa, useEmpresas } from "./hooks";
import { SITUACOES, prazoTeste, quandoRelativo, situacaoEmpresa, type Situacao } from "./lib";
import { FiltroChips, type OpcaoChip } from "./components/FiltroChips";
import { CriarEmpresaDialog } from "./components/EmpresaDialogs";

type Linha = EmpresaRow & { situacao: Situacao };
type Filtro = "ativas" | Situacao;

export default function Empresas() {
  usePageTitle("Empresas · Ultra admin");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState("");
  const [criarAberto, setCriarAberto] = useState(false);
  const query = useEmpresas();

  const pedido = params.get("situacao");
  const filtro: Filtro = SITUACOES.includes(pedido as Situacao) ? (pedido as Situacao) : "ativas";
  const setFiltro = (f: Filtro) => setParams(f === "ativas" ? {} : { situacao: f }, { replace: true });

  const linhas = useMemo<Linha[]>(
    () => (query.data ?? []).map((e) => ({ ...e, situacao: situacaoEmpresa(e.status, e.cobranca) })),
    [query.data]
  );

  const opcoes = useMemo<OpcaoChip<Filtro>[]>(() => {
    const conta = (s: Situacao) => linhas.filter((l) => l.situacao === s).length;
    return [
      { value: "ativas", label: "Todas", count: linhas.filter((l) => l.situacao !== "arquivada").length },
      ...SITUACOES.filter((s) => conta(s) > 0 || s === filtro).map((s) => ({
        value: s,
        label: statusLabel("empresa_situacao", s),
        count: conta(s),
      })),
    ];
  }, [linhas, filtro]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtro === "ativas" ? l.situacao === "arquivada" : l.situacao !== filtro) return false;
      if (!q) return true;
      return l.nome.toLowerCase().includes(q) || (l.cnpj ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || q);
    });
  }, [linhas, filtro, busca]);

  const criar = useAcaoEmpresa({
    run: async (input: { nome: string; ownerEmail: string }) => {
      const res = (await edgeFetch("ultra-admin-empresas", {
        method: "POST",
        body: { nome: input.nome, owner_email: input.ownerEmail },
      })) as { warning?: string | null; empresa_id?: string };
      return res;
    },
    sucesso: null,
    erro: "Não foi possível criar a empresa",
    contexto: "ultra-admin-empresas:create",
  });

  const colunas: ColumnDef<Linha>[] = [
    {
      key: "nome",
      header: "Empresa",
      getSortValue: (r) => r.nome,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{r.nome}</p>
          {r.cnpj && <p className="text-xs text-ink-muted tabular-nums">{r.cnpj}</p>}
        </div>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      getSortValue: (r) => SITUACOES.indexOf(r.situacao),
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge domain="empresa_situacao" status={r.situacao} />
          {r.situacao === "em_teste" && (
            <span className="text-xs text-ink-muted">{prazoTeste(r.cobranca.trialEndsAt)}</span>
          )}
        </div>
      ),
    },
    {
      key: "plano",
      header: "Plano",
      getSortValue: (r) => r.plano,
      cell: (r) => <span className="text-ink-soft">{PLAN_LABEL[r.plano]}</span>,
    },
    {
      key: "usuarios",
      header: "Usuários",
      align: "end",
      getSortValue: (r) => r.usersCount,
      cell: (r) => <span className="tabular-nums text-ink-soft">{r.usersCount}</span>,
    },
    {
      key: "ultimoAcesso",
      header: "Último acesso",
      getSortValue: (r) => r.ultimoAcesso ?? "",
      cell: (r) => <span className="text-ink-soft">{quandoRelativo(r.ultimoAcesso) ?? "Ninguém entrou"}</span>,
    },
    {
      key: "criadaEm",
      header: "Criada",
      getSortValue: (r) => r.createdAt ?? "",
      cell: (r) => <span className="text-ink-soft">{quandoRelativo(r.createdAt) ?? "-"}</span>,
    },
  ];

  return (
    <PilarPage
      title="Empresas"
      search={{ value: busca, onChange: setBusca, placeholder: "Buscar por nome ou CNPJ" }}
      primaryAction={{ label: "Criar empresa", onClick: () => setCriarAberto(true), icon: Plus }}
    >
      <FiltroChips ariaLabel="Filtrar por situação" opcoes={opcoes} value={filtro} onChange={setFiltro} />

      <DataTable
        columns={colunas}
        data={toDataSourceResult<Linha>({ data: visiveis, isLoading: query.isLoading, error: query.error })}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/ultra-admin/empresas/${r.id}`)}
        defaultSortKey="criadaEm"
        defaultSortDir="desc"
        minWidth="760px"
        errorTitle="Não foi possível carregar as empresas"
        emptyState={
          <EmptyState
            icon={Building2}
            title={busca ? "Nenhuma empresa com esse nome ou CNPJ" : "Nenhuma empresa nesta situação"}
            description={busca ? "Confira a grafia ou limpe a busca." : undefined}
          />
        }
      />

      <CriarEmpresaDialog
        open={criarAberto}
        onOpenChange={setCriarAberto}
        isPending={criar.isPending}
        onConfirm={(input) =>
          criar.mutate(input, {
            onSuccess: (res) => {
              setCriarAberto(false);
              const r = res as { warning?: string | null; empresa_id?: string };
              if (r.warning) toast.warning("Empresa criada com ressalva", { description: r.warning });
              else toast.success("Empresa criada", { description: "O dono recebeu o convite por e-mail." });
              if (r.empresa_id) navigate(`/ultra-admin/empresas/${r.empresa_id}`);
            },
          })
        }
      />
    </PilarPage>
  );
}

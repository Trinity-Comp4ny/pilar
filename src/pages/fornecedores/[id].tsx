import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Mail,
  Phone,
  ShoppingCart,
  Trophy,
  User,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SectionTabs, type SectionTab } from "@/components/SectionTabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFornecedorAvaliacoes } from "@/hooks/useFornecedorAvaliacoes";
import { formatarNota } from "@/lib/cotacaoConvite";
import { AvaliacoesFornecedor, notaMedia } from "./AvaliacoesFornecedor";
import { useFornecedorDetalhe, type CompraView, type CotacaoView, type ItemView } from "@/hooks/useFornecedorDetalhe";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import type { ObraRollup } from "@/lib/fornecedorInsights";
import { formatDate } from "@/lib/format";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { formatCNPJ, formatPhone } from "@/lib/maskUtils";
import type { StatusProposta } from "@/lib/fornecedorInsights";

import { PageLoader } from "@/components/motion/PageLoader";
const BREADCRUMB = [{ label: "Fornecedores", to: "/fornecedores" }];
const TODAS = "__todas__";

function statusBadge(status: StatusProposta) {
  if (status === "venceu") return { label: "Venceu", className: "bg-brand text-ink border-transparent" };
  if (status === "aberta") return { label: "Em aberto", className: "" };
  return { label: "Não venceu", className: "" };
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

type Moeda = (valor: number) => string;

// Colunas das tabelas do detalhe (SPEC 127): todas no DataTable padrão.
const obrasColumns = (formatCurrency: Moeda): ColumnDef<ObraRollup>[] => [
  { key: "obra", header: "Obra", className: "font-medium", cell: (o) => o.obraNome },
  {
    key: "cotado",
    header: "Total cotado",
    align: "end",
    className: "tabular-nums",
    cell: (o) => formatCurrency(o.totalCotado),
  },
  {
    key: "comprado",
    header: "Total comprado",
    align: "end",
    className: "tabular-nums",
    cell: (o) => formatCurrency(o.totalComprado),
  },
  { key: "cotacoes", header: "Cotações", align: "end", className: "tabular-nums", cell: (o) => o.cotacoes },
  { key: "vitorias", header: "Vitórias", align: "end", className: "tabular-nums", cell: (o) => o.vitorias },
];

const comprasColumns = (formatCurrency: Moeda, abrirObra: (obraId: string) => void): ColumnDef<CompraView>[] => [
  { key: "data", header: "Data", className: "whitespace-nowrap tabular-nums", cell: (c) => formatDate(c.data) },
  {
    key: "obra",
    header: "Obra",
    cell: (c) => (
      <button className="underline-offset-2 hover:underline" onClick={() => abrirObra(c.obraId)}>
        {c.obraNome}
      </button>
    ),
  },
  { key: "etapa", header: "Etapa", className: "text-sm text-muted-foreground", cell: (c) => c.frente ?? "—" },
  { key: "descricao", header: "Descrição", cell: (c) => c.descricao },
  { key: "valor", header: "Valor", align: "end", className: "tabular-nums", cell: (c) => formatCurrency(c.valor) },
  {
    key: "comprovante",
    header: <span className="sr-only">Comprovante</span>,
    align: "end",
    cell: (c) =>
      c.comprovanteUrl ? (
        <a
          href={c.comprovanteUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
          aria-label="Abrir comprovante"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null,
  },
];

type ItemComIndice = ItemView & { indice: number };

const itensColumns = (formatCurrency: Moeda): ColumnDef<ItemComIndice>[] => [
  { key: "item", header: "Item", cell: (it) => it.descricao },
  {
    key: "qtd",
    header: "Qtd",
    align: "end",
    className: "tabular-nums",
    cell: (it) => `${it.quantidade ?? "—"} ${it.unidade ?? ""}`,
  },
  {
    key: "preco",
    header: "Preço unit.",
    align: "end",
    className: "tabular-nums",
    cell: (it) => (it.preco_unitario != null ? formatCurrency(it.preco_unitario) : "—"),
  },
  {
    key: "total",
    header: "Total",
    align: "end",
    className: "tabular-nums",
    cell: (it) => formatCurrency(it.valor_total),
  },
];

export default function FornecedorDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useFornecedorDetalhe(id);
  const { data: avaliacoes = [] } = useFornecedorAvaliacoes(id);
  usePageTitle(data?.fornecedor.nome ?? "Fornecedor");
  const formatCurrency = useMoneyMask();

  const [tab, setTab] = useState("cotacoes");
  const [obraFiltro, setObraFiltro] = useState<string>(TODAS);
  const [expandida, setExpandida] = useState<Set<string>>(new Set());

  const obrasDasCotacoes = useMemo(() => {
    const mapa = new Map<string, string>();
    (data?.cotacoes ?? []).forEach((c) => mapa.set(c.obraId, c.obraNome));
    return [...mapa.entries()].map(([obraId, obraNome]) => ({ obraId, obraNome }));
  }, [data?.cotacoes]);

  const cotacoesFiltradas = useMemo(
    () => (data?.cotacoes ?? []).filter((c) => obraFiltro === TODAS || c.obraId === obraFiltro),
    [data?.cotacoes, obraFiltro]
  );

  if (isLoading) {
    return (
      <PageLayout>
        <PageLoader size="page" />
      </PageLayout>
    );
  }

  if (isError || !data || !id) {
    return (
      <PageLayout header={<PageHeader title="Fornecedor não encontrado" breadcrumbs={BREADCRUMB} />}>
        <p className="text-sm text-muted-foreground">
          Este fornecedor não existe ou foi removido.{" "}
          <button onClick={() => navigate("/obras/fornecedores")} className="underline">
            Voltar para Fornecedores
          </button>
        </p>
      </PageLayout>
    );
  }

  const { fornecedor, resumo, cotacoes, compras, obras } = data;

  const toggleExpandida = (propostaId: string) => {
    setExpandida((prev) => {
      const next = new Set(prev);
      if (next.has(propostaId)) next.delete(propostaId);
      else next.add(propostaId);
      return next;
    });
  };

  // Abas de seção (SPEC 124), no slot do header.
  const secoes: SectionTab[] = [
    { id: "cotacoes", label: "Cotações", badge: cotacoes.length },
    { id: "obras", label: "Obras", badge: obras.length },
    { id: "compras", label: "Compras", badge: compras.length },
    { id: "avaliacoes", label: "Avaliações", badge: avaliacoes.length },
  ];

  return (
    <PageLayout
      header={<PageHeader title={fornecedor.nome} breadcrumbs={BREADCRUMB} />}
      tabs={<SectionTabs tabs={secoes} value={tab} onValueChange={setTab} ariaLabel="Seções do fornecedor" />}
    >
      {/* Dados do cadastro */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {fornecedor.cnpj && <span className="tabular-nums">{formatCNPJ(fornecedor.cnpj)}</span>}
        {fornecedor.contato && (
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {fornecedor.contato}
          </span>
        )}
        {fornecedor.telefone && (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            {formatPhone(fornecedor.telefone)}
          </span>
        )}
        {fornecedor.email && (
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            {fornecedor.email}
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard label="Obras" value={String(resumo.obras)} />
        <KpiCard label="Total comprado" value={formatCurrency(resumo.totalComprado)} hint="Conta da obra" />
        <KpiCard
          label="Cotações"
          value={String(resumo.cotacoesParticipadas)}
          hint={`${Math.round(resumo.taxaVitoria * 100)}% de vitória (${resumo.vitorias})`}
        />
        <KpiCard label="Ticket médio" value={formatCurrency(resumo.ticketMedio)} />
        <KpiCard label="Última compra" value={resumo.ultimaCompra ? formatDate(resumo.ultimaCompra) : "—"} />
        <KpiCard
          label="Nota"
          value={avaliacoes.length > 0 ? formatarNota(notaMedia(avaliacoes)) : "Sem avaliação"}
          hint={
            avaliacoes.length > 0
              ? `${avaliacoes.length} ${avaliacoes.length === 1 ? "avaliação" : "avaliações"}`
              : undefined
          }
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        {/* Cotações */}
        <TabsContent value="cotacoes" className="mt-4">
          {cotacoes.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Nenhuma cotação"
              description="Quando este fornecedor mandar um orçamento numa cotação de obra, ele aparece aqui."
            />
          ) : (
            <>
              {obrasDasCotacoes.length > 1 && (
                <div className="mb-3 w-full sm:w-64">
                  <Select value={obraFiltro} onValueChange={setObraFiltro}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODAS}>Todas as obras</SelectItem>
                      {obrasDasCotacoes.map((o) => (
                        <SelectItem key={o.obraId} value={o.obraId}>
                          {o.obraNome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                {cotacoesFiltradas.map((c) => (
                  <CotacaoLinha
                    key={c.propostaId}
                    cotacao={c}
                    aberta={expandida.has(c.propostaId)}
                    onToggle={() => toggleExpandida(c.propostaId)}
                    onAbrirObra={() => navigate(`/obras/${c.obraId}`)}
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Obras */}
        <TabsContent value="obras" className="mt-4">
          {obras.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nenhuma obra"
              description="Este fornecedor ainda não participou de cotações nem teve compras em obras."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <DataTable
                columns={obrasColumns(formatCurrency)}
                data={{ rows: obras, isPending: false, error: null }}
                rowKey={(o) => o.obraId}
                onRowClick={(o) => navigate(`/obras/${o.obraId}`)}
                rowLabel={(o) => `Abrir a obra ${o.obraNome}`}
              />
            </div>
          )}
        </TabsContent>

        {/* Compras */}
        <TabsContent value="compras" className="mt-4">
          {compras.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Nenhuma compra"
              description="Compras lançadas na conta da obra com este fornecedor aparecem aqui."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <DataTable
                columns={comprasColumns(formatCurrency, (obraId) => navigate(`/obras/${obraId}`))}
                data={{ rows: compras, isPending: false, error: null }}
                rowKey={(c) => c.lancamentoId}
              />
            </div>
          )}
        </TabsContent>

        {/* Avaliações (SPEC 144) */}
        <TabsContent value="avaliacoes" className="mt-4">
          <AvaliacoesFornecedor avaliacoes={avaliacoes} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}

function CotacaoLinha({
  cotacao,
  aberta,
  onToggle,
  onAbrirObra,
}: {
  cotacao: CotacaoView;
  aberta: boolean;
  onToggle: () => void;
  onAbrirObra: () => void;
}) {
  const formatCurrency = useMoneyMask();
  const badge = statusBadge(cotacao.status);
  const temItens = cotacao.itens.length > 0;

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={onToggle}
          disabled={!temItens}
          className="text-muted-foreground disabled:opacity-30"
          aria-label={aberta ? "Recolher itens" : "Expandir itens"}
        >
          {aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{cotacao.descricao}</p>
          <button className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={onAbrirObra}>
            {cotacao.obraNome}
          </button>
        </div>
        <Badge variant="secondary" className={badge.className}>
          {badge.label}
        </Badge>
        <span className="w-28 text-right text-sm font-semibold tabular-nums">{formatCurrency(cotacao.valor)}</span>
      </div>
      {aberta && temItens && (
        <div className="border-t px-3 py-2">
          <DataTable
            columns={itensColumns(formatCurrency)}
            data={{ rows: cotacao.itens.map((it, indice) => ({ ...it, indice })), isPending: false, error: null }}
            rowKey={(it) => String(it.indice)}
          />
        </div>
      )}
    </div>
  );
}

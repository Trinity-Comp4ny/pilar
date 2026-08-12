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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFornecedorDetalhe, type CotacaoView } from "@/hooks/useFornecedorDetalhe";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatCNPJ, formatPhone } from "@/lib/maskUtils";
import type { StatusProposta } from "@/lib/fornecedorInsights";

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

export default function FornecedorDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useFornecedorDetalhe(id);
  usePageTitle(data?.fornecedor.nome ?? "Fornecedor");

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
      <PageLayout header={<PageHeader title="Carregando…" breadcrumbs={BREADCRUMB} />}>
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl mt-4" />
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

  return (
    <PageLayout header={<PageHeader title={fornecedor.nome} breadcrumbs={BREADCRUMB} />}>
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
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Obras" value={String(resumo.obras)} />
        <KpiCard label="Total comprado" value={formatCurrency(resumo.totalComprado)} hint="Conta da obra" />
        <KpiCard
          label="Cotações"
          value={String(resumo.cotacoesParticipadas)}
          hint={`${Math.round(resumo.taxaVitoria * 100)}% de vitória (${resumo.vitorias})`}
        />
        <KpiCard label="Ticket médio" value={formatCurrency(resumo.ticketMedio)} />
        <KpiCard label="Última compra" value={resumo.ultimaCompra ? formatDate(resumo.ultimaCompra) : "—"} />
      </div>

      <Tabs defaultValue="cotacoes" className="mt-6">
        <TabsList>
          <TabsTrigger value="cotacoes">Cotações ({cotacoes.length})</TabsTrigger>
          <TabsTrigger value="obras">Obras ({obras.length})</TabsTrigger>
          <TabsTrigger value="compras">Compras ({compras.length})</TabsTrigger>
        </TabsList>

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Obra</TableHead>
                    <TableHead className="text-right">Total cotado</TableHead>
                    <TableHead className="text-right">Total comprado</TableHead>
                    <TableHead className="text-right">Cotações</TableHead>
                    <TableHead className="text-right">Vitórias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {obras.map((o) => (
                    <TableRow key={o.obraId} className="cursor-pointer" onClick={() => navigate(`/obras/${o.obraId}`)}>
                      <TableCell className="font-medium">{o.obraNome}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(o.totalCotado)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(o.totalComprado)}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.cotacoes}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.vitorias}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.map((c) => (
                    <TableRow key={c.lancamentoId}>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatDate(c.data)}</TableCell>
                      <TableCell>
                        <button
                          className="underline-offset-2 hover:underline"
                          onClick={() => navigate(`/obras/${c.obraId}`)}
                        >
                          {c.obraNome}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.frente ?? "—"}</TableCell>
                      <TableCell>{c.descricao}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.valor)}</TableCell>
                      <TableCell className="text-right">
                        {c.comprovanteUrl && (
                          <a
                            href={c.comprovanteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-muted-foreground hover:text-foreground"
                            aria-label="Abrir comprovante"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cotacao.itens.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{it.descricao}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {it.quantidade ?? "—"} {it.unidade ?? ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {it.preco_unitario != null ? formatCurrency(it.preco_unitario) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(it.valor_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

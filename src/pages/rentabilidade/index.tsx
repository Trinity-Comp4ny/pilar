import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, Clock, BarChart3, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useDashboardRentabilidade } from "@/hooks/useRentabilidade";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatPct = (value: number) => `${value.toFixed(1)}%`;

function MargemBadge({ pct }: { pct: number }) {
  if (pct >= 30) return <Badge className="bg-green-100 text-green-800 text-xs">{formatPct(pct)}</Badge>;
  if (pct >= 15) return <Badge className="bg-yellow-100 text-yellow-800 text-xs">{formatPct(pct)}</Badge>;
  if (pct >= 0) return <Badge className="bg-orange-100 text-orange-800 text-xs">{formatPct(pct)}</Badge>;
  return <Badge className="bg-red-100 text-red-800 text-xs">{formatPct(pct)}</Badge>;
}

export default function Rentabilidade() {
  const { data, isLoading } = useDashboardRentabilidade();

  if (isLoading) {
    return (
      <PageLayout>
        <PageHeader title="Rentabilidade" description="Visão geral da rentabilidade dos projetos" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  const { metricas, projetos = [], topRentaveis = [], menosRentaveis = [] } = data || {
    metricas: { totalReceitas: 0, totalDespesas: 0, margemBrutaTotal: 0, margemMediaPct: 0, totalHorasOrcadas: 0, totalHorasConsumidas: 0, utilizacaoHoras: 0, totalProjetos: 0, projetosComReceita: 0 },
    projetos: [],
    topRentaveis: [],
    menosRentaveis: [],
  };

  const chartData = topRentaveis.map((p) => ({
    nome: p.codigo_projeto || p.projeto_nome.substring(0, 15),
    margem: p.margem_bruta_pct,
  }));

  const chartDataMenos = menosRentaveis.map((p) => ({
    nome: p.codigo_projeto || p.projeto_nome.substring(0, 15),
    margem: p.margem_bruta_pct,
  }));

  return (
    <PageLayout>
      <PageHeader title="Rentabilidade" description="Visão geral da rentabilidade dos projetos" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" /> Receitas
            </div>
            <p className="text-lg font-bold">{formatCurrency(metricas.totalReceitas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4" /> Despesas Diretas
            </div>
            <p className="text-lg font-bold">{formatCurrency(metricas.totalDespesas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /> Margem Bruta
            </div>
            <p className="text-lg font-bold">{formatCurrency(metricas.margemBrutaTotal)}</p>
            <MargemBadge pct={metricas.margemMediaPct} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" /> Utilização de Horas
            </div>
            <p className="text-lg font-bold">{formatPct(metricas.utilizacaoHoras)}</p>
            <p className="text-xs text-muted-foreground">
              {metricas.totalHorasConsumidas.toFixed(0)}h / {metricas.totalHorasOrcadas.toFixed(0)}h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts - Top rentáveis e menos rentáveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" /> Mais Rentáveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} fontSize={11} />
                  <YAxis type="category" dataKey="nome" width={80} fontSize={11} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="margem" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="#22c55e" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" /> Menos Rentáveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartDataMenos.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartDataMenos} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} fontSize={11} />
                  <YAxis type="category" dataKey="nome" width={80} fontSize={11} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="margem" radius={[0, 4, 4, 0]}>
                    {chartDataMenos.map((entry, i) => (
                      <Cell key={i} fill={entry.margem < 0 ? "#ef4444" : "#f97316"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de projetos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Todos os Projetos ({metricas.totalProjetos})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projetos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum projeto encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Projeto</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Contrato</TableHead>
                    <TableHead className="text-xs text-right">Receitas</TableHead>
                    <TableHead className="text-xs text-right">Despesas</TableHead>
                    <TableHead className="text-xs text-center">Margem Bruta</TableHead>
                    <TableHead className="text-xs text-center">Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projetos.map((p) => (
                    <TableRow key={p.projeto_id}>
                      <TableCell className="text-xs py-2">
                        <span className="font-medium">{p.codigo_projeto}</span>
                        <span className="text-muted-foreground ml-1">- {p.projeto_nome}</span>
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(p.valor_contrato)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(p.receitas_total)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(p.despesas_diretas)}</TableCell>
                      <TableCell className="text-xs py-2 text-center">
                        <MargemBadge pct={p.margem_bruta_pct} />
                      </TableCell>
                      <TableCell className="text-xs py-2 text-center">
                        {p.horas_orcadas > 0 ? (
                          <span className={p.horas_consumidas > p.horas_orcadas ? "text-red-600 font-semibold" : ""}>
                            {p.horas_consumidas.toFixed(0)}/{p.horas_orcadas.toFixed(0)}h
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}

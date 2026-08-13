import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/KPICard";
import { formatCurrency as fmtMoeda } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, DollarSign, Clock, BarChart3, Loader2, AlertTriangle, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import {
  useDashboardRentabilidade,
  useRentabilidadePorCliente,
  useProjetosDrenandoCaixa,
} from "@/hooks/useRentabilidade";

const formatCurrency = (value: number) => fmtMoeda(value);

const formatPct = (value: number) => `${value.toFixed(1)}%`;

function MargemBadge({ pct }: { pct: number }) {
  if (pct >= 30) return <Badge className="bg-positive/10 text-positive-strong text-xs">{formatPct(pct)}</Badge>;
  if (pct >= 15)
    return (
      <Badge variant="warning" className="text-xs">
        {formatPct(pct)}
      </Badge>
    );
  if (pct >= 0)
    return (
      <Badge variant="attention" className="text-xs">
        {formatPct(pct)}
      </Badge>
    );
  return (
    <Badge variant="danger" className="text-xs">
      {formatPct(pct)}
    </Badge>
  );
}

export default function Rentabilidade() {
  const { data, isLoading } = useDashboardRentabilidade();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const {
    metricas,
    projetos = [],
    topRentaveis = [],
    menosRentaveis = [],
  } = data || {
    metricas: {
      totalReceitas: 0,
      totalDespesas: 0,
      margemBrutaTotal: 0,
      margemMediaPct: 0,
      totalHorasOrcadas: 0,
      totalHorasConsumidas: 0,
      utilizacaoHoras: 0,
      totalProjetos: 0,
      projetosComReceita: 0,
    },
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
    <Tabs defaultValue="por-projeto" className="space-y-6">
      <TabsList>
        <TabsTrigger value="por-projeto">Por Projeto</TabsTrigger>
        <TabsTrigger value="por-cliente">Por Cliente</TabsTrigger>
        <TabsTrigger value="riscos">Riscos</TabsTrigger>
      </TabsList>

      <TabsContent value="por-projeto" className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Receitas" value={metricas.totalReceitas} tone="positive" icon={DollarSign} />
          <KPICard label="Despesas Diretas" value={metricas.totalDespesas} tone="danger" icon={TrendingDown} />
          <KPICard
            label="Margem Bruta"
            value={metricas.margemBrutaTotal}
            tone={metricas.margemBrutaTotal >= 0 ? "positive" : "danger"}
            icon={TrendingUp}
            subtitle={formatPct(metricas.margemMediaPct)}
            subtitleTone={metricas.margemMediaPct >= 0 ? "positive" : "danger"}
          />
          <KPICard
            label="Utilização de Horas"
            value={formatPct(metricas.utilizacaoHoras)}
            icon={Clock}
            subtitle={`${metricas.totalHorasConsumidas.toFixed(0)}h / ${metricas.totalHorasOrcadas.toFixed(0)}h`}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-positive-strong" /> Mais Rentáveis
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
                        <Cell key={i} fill="hsl(var(--chart-success))" />
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
                <TrendingDown className="h-4 w-4 text-negative-strong" /> Menos Rentáveis
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
                        <Cell
                          key={i}
                          fill={entry.margem < 0 ? "hsl(var(--chart-danger))" : "hsl(var(--c-orange-500))"}
                        />
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
                          <Badge variant="secondary" className="text-[10px]">
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right">{formatCurrency(p.valor_contrato)}</TableCell>
                        <TableCell className="text-xs py-2 text-right">{formatCurrency(p.receitas_total)}</TableCell>
                        <TableCell className="text-xs py-2 text-right">{formatCurrency(p.despesas_diretas)}</TableCell>
                        <TableCell className="text-xs py-2 text-center">
                          <MargemBadge pct={p.margem_bruta_pct} />
                        </TableCell>
                        <TableCell className="text-xs py-2 text-center">
                          {p.horas_orcadas > 0 ? (
                            <span
                              className={p.horas_consumidas > p.horas_orcadas ? "text-negative-strong font-semibold" : ""}
                            >
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
      </TabsContent>

      <TabsContent value="por-cliente">
        <RentabilidadePorClienteTab />
      </TabsContent>

      <TabsContent value="riscos">
        <RiscosTab />
      </TabsContent>
    </Tabs>
  );
}

function RentabilidadePorClienteTab() {
  const { data, isLoading } = useRentabilidadePorCliente();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { clientes = [] } = data || {};

  const COLORS = [
    "hsl(var(--chart-success-alt))",
    "hsl(var(--chart-info))",
    "hsl(var(--chart-warning-alt))",
    "hsl(var(--chart-danger))",
    "hsl(var(--c-violet-500))",
    "hsl(var(--c-pink-500))",
    "hsl(var(--c-cyan-500))",
    "hsl(var(--c-lime-500))",
  ];

  const pieData = clientes.slice(0, 8).map((c, i) => ({
    name: c.cliente_nome,
    value: c.total_receitas,
    fill: COLORS[i % COLORS.length],
  }));

  const clienteConcentrado = clientes.find((c) => c.concentracao_pct > 30);

  return (
    <div className="space-y-6">
      {clienteConcentrado && (
        <Card className="border-warning-mid-border bg-warning-soft">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-mid flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning-strong">Risco de concentração</p>
              <p className="text-xs text-warning-mid">
                {clienteConcentrado.cliente_nome} representa {clienteConcentrado.concentracao_pct.toFixed(0)}% da
                receita total. Diversifique sua base para reduzir risco.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" /> Concentração de Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name.substring(0, 12)} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-positive-strong" /> Ranking por Margem
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientes.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={clientes.slice(0, 8)} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="cliente_nome"
                    width={100}
                    fontSize={10}
                    tickFormatter={(v) => v.substring(0, 15)}
                  />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="margem_bruta_pct" radius={[0, 4, 4, 0]}>
                    {clientes.slice(0, 8).map((c, i) => (
                      <Cell
                        key={i}
                        fill={c.margem_bruta_pct >= 0 ? "hsl(var(--chart-success))" : "hsl(var(--chart-danger))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Todos os Clientes ({clientes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs text-center">Projetos</TableHead>
                  <TableHead className="text-xs text-right">Receitas</TableHead>
                  <TableHead className="text-xs text-right">Despesas</TableHead>
                  <TableHead className="text-xs text-center">Margem</TableHead>
                  <TableHead className="text-xs text-center">Concentração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.cliente_id}>
                    <TableCell className="text-xs py-2 font-medium">{c.cliente_nome}</TableCell>
                    <TableCell className="text-xs py-2 text-center">{c.num_projetos}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{formatCurrency(c.total_receitas)}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{formatCurrency(c.total_despesas)}</TableCell>
                    <TableCell className="text-xs py-2 text-center">
                      <MargemBadge pct={c.margem_bruta_pct} />
                    </TableCell>
                    <TableCell className="text-xs py-2 text-center">
                      <Badge variant={c.concentracao_pct > 30 ? "destructive" : "secondary"} className="text-[10px]">
                        {c.concentracao_pct.toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RiscosTab() {
  const { data: projetosDrenando = [], isLoading } = useProjetosDrenandoCaixa();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalDeficit = projetosDrenando.reduce((s, p) => s + Math.abs(p.margem_bruta), 0);

  return (
    <div className="space-y-6">
      {projetosDrenando.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 text-positive-strong opacity-50" />
            <p className="text-sm text-muted-foreground">Nenhum projeto com margem negativa. Parabéns!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-danger-mid-border bg-danger-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-danger-mid flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-danger-strong">
                  {projetosDrenando.length} projeto(s) drenando caixa
                </p>
                <p className="text-xs text-negative-strong">Déficit total: {formatCurrency(totalDeficit)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-negative-strong" /> Projetos com Margem Negativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Projeto</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Receitas</TableHead>
                      <TableHead className="text-xs text-right">Despesas</TableHead>
                      <TableHead className="text-xs text-right">Déficit</TableHead>
                      <TableHead className="text-xs text-center">Margem</TableHead>
                      <TableHead className="text-xs text-center">Horas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projetosDrenando.map((p) => (
                      <TableRow key={p.projeto_id} className="bg-danger-soft/50">
                        <TableCell className="text-xs py-2">
                          <span className="font-medium">{p.codigo_projeto}</span>
                          <span className="text-muted-foreground ml-1">- {p.projeto_nome}</span>
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right">{formatCurrency(p.receitas_total)}</TableCell>
                        <TableCell className="text-xs py-2 text-right">{formatCurrency(p.despesas_diretas)}</TableCell>
                        <TableCell className="text-xs py-2 text-right text-negative-strong font-semibold">
                          {formatCurrency(Math.abs(p.margem_bruta))}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-center">
                          <MargemBadge pct={p.margem_bruta_pct} />
                        </TableCell>
                        <TableCell className="text-xs py-2 text-center">
                          {p.horas_orcadas > 0 ? (
                            <span
                              className={p.horas_consumidas > p.horas_orcadas ? "text-negative-strong font-semibold" : ""}
                            >
                              {p.horas_consumidas.toFixed(0)}/{p.horas_orcadas.toFixed(0)}h
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

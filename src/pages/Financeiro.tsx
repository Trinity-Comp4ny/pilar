import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import Receitas from "./Receitas";
import Despesas from "./Despesas";

export default function Financeiro() {
  // Mock data - substituir por dados reais posteriormente
  const stats = {
    receitasTotal: 145000,
    despesasTotal: 98000,
    saldo: 47000,
    receitasMes: 12.5,
    despesasMes: -8.2,
  };

  const chartDataMensal = [
    { mes: 'Jan', receitas: 85000, despesas: 62000 },
    { mes: 'Fev', receitas: 92000, despesas: 68000 },
    { mes: 'Mar', receitas: 105000, despesas: 75000 },
    { mes: 'Abr', receitas: 118000, despesas: 82000 },
    { mes: 'Mai', receitas: 135000, despesas: 89000 },
    { mes: 'Jun', receitas: 145000, despesas: 98000 },
  ];

  const categoriaData = [
    { name: 'Projetos', value: 85000, color: 'hsl(var(--chart-primary))' },
    { name: 'Consultorias', value: 35000, color: 'hsl(var(--chart-accent-1))' },
    { name: 'Outros', value: 25000, color: 'hsl(var(--chart-secondary))' },
  ];

  const despesasCategoriaData = [
    { name: 'Pessoal', value: 45000, color: 'hsl(var(--chart-danger))' },
    { name: 'Operacional', value: 28000, color: 'hsl(var(--chart-accent-2))' },
    { name: 'Infraestrutura', value: 15000, color: 'hsl(var(--chart-accent-4))' },
    { name: 'Marketing', value: 10000, color: 'hsl(var(--chart-info))' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Financeiro</h1>
        <p className="text-sm text-black/60 mt-1">Gerencie receitas e despesas</p>
      </div>

      <Tabs defaultValue="visao-geral" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="fluxo-caixa">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="mensal">Resumo Mensal</TabsTrigger>
          <TabsTrigger value="anual">Resumo Anual</TabsTrigger>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
        </TabsList>
        
        {/* Visão Geral */}
        <TabsContent value="visao-geral" className="mt-6 space-y-6">
          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-black/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Receitas Totais</CardTitle>
                <div className="p-2 rounded-full bg-green-500">
                  <TrendingUp size={18} className="text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  R$ {(stats.receitasTotal / 1000).toFixed(0)}k
                </div>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <TrendingUp size={12} />
                  +{stats.receitasMes}% vs mês anterior
                </p>
              </CardContent>
            </Card>

            <Card className="border border-black/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Despesas Totais</CardTitle>
                <div className="p-2 rounded-full bg-red-500">
                  <TrendingDown size={18} className="text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  R$ {(stats.despesasTotal / 1000).toFixed(0)}k
                </div>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <TrendingDown size={12} />
                  {stats.despesasMes}% vs mês anterior
                </p>
              </CardContent>
            </Card>

            <Card className="border border-black/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Saldo</CardTitle>
                <div className="p-2 rounded-full bg-[hsl(var(--primary))]">
                  <DollarSign size={18} className="text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  R$ {(stats.saldo / 1000).toFixed(0)}k
                </div>
                <p className="text-xs text-black/50 mt-1">
                  Receitas - Despesas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Tendência */}
          <Card className="border border-black/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar size={20} />
                Evolução Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartDataMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="receitas" 
                    stroke="hsl(var(--chart-success))" 
                    strokeWidth={2}
                    name="Receitas"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="despesas" 
                    stroke="hsl(var(--chart-danger))" 
                    strokeWidth={2}
                    name="Despesas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráficos de Pizza */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Receitas por Categoria */}
            <Card className="border border-black/5">
              <CardHeader>
                <CardTitle>Receitas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoriaData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoriaData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Despesas por Categoria */}
            <Card className="border border-black/5">
              <CardHeader>
                <CardTitle>Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={despesasCategoriaData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {despesasCategoriaData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Fluxo de Caixa */}
        <TabsContent value="fluxo-caixa" className="mt-6 space-y-6">
          <Card className="border border-black/5">
            <CardHeader>
              <CardTitle>Fluxo de Caixa - Últimos 12 Meses</CardTitle>
              <CardDescription>Entrada e saída de recursos financeiros</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartDataMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="receitas" fill="hsl(var(--chart-success))" name="Receitas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="hsl(var(--chart-danger))" name="Despesas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-black/5">
              <CardHeader>
                <CardTitle>Patrimônio (Caixa)</CardTitle>
                <CardDescription>Saldo acumulado ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="text-sm text-green-700 font-medium">Saldo Atual</p>
                      <p className="text-3xl font-bold text-green-700 mt-1">R$ 47.000</p>
                    </div>
                    <DollarSign className="h-12 w-12 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-black/60">Saldo Inicial (Jan)</span>
                      <span className="font-medium">R$ 10.000</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-black/60">Total Entradas</span>
                      <span className="font-medium text-green-600">R$ 145.000</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-black/60">Total Saídas</span>
                      <span className="font-medium text-red-600">R$ 98.000</span>
                    </div>
                    <div className="h-px bg-black/10 my-2"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Patrimônio Líquido</span>
                      <span className="font-bold text-lg">R$ 57.000</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-black/5">
              <CardHeader>
                <CardTitle>Indicadores</CardTitle>
                <CardDescription>Métricas financeiras importantes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Taxa de Crescimento</span>
                      <span className="text-sm font-medium text-green-600">+32%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: '32%'}}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Margem de Lucro</span>
                      <span className="text-sm font-medium text-blue-600">32%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{width: '32%'}}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Eficiência Operacional</span>
                      <span className="text-sm font-medium text-purple-600">68%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{width: '68%'}}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Capacidade de Pagamento</span>
                      <span className="text-sm font-medium text-orange-600">85%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full" style={{width: '85%'}}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Resumo Mensal */}
        <TabsContent value="mensal" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border border-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Receitas do Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">R$ 145k</div>
                <p className="text-xs text-green-600 mt-1">+12.5% vs mês anterior</p>
              </CardContent>
            </Card>
            <Card className="border border-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Despesas do Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">R$ 98k</div>
                <p className="text-xs text-green-600 mt-1">-8.2% vs mês anterior</p>
              </CardContent>
            </Card>
            <Card className="border border-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Lucro do Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ 47k</div>
                <p className="text-xs text-black/50 mt-1">Margem de 32%</p>
              </CardContent>
            </Card>
            <Card className="border border-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Projeção</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">R$ 52k</div>
                <p className="text-xs text-blue-600 mt-1">Próximo mês</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-black/5">
            <CardHeader>
              <CardTitle>Detalhamento Mensal</CardTitle>
              <CardDescription>Análise detalhada do mês de Junho/2024</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Top 5 Receitas</h4>
                  <div className="space-y-2">
                    {[
                      {nome: "Projeto Residencial XYZ", valor: 45000},
                      {nome: "Consultoria Empresa ABC", valor: 28000},
                      {nome: "Projeto Comercial 123", valor: 32000},
                      {nome: "Manutenção Predial", valor: 15000},
                      {nome: "Projeto de Interiores", valor: 25000}
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="text-sm">{item.nome}</span>
                        <span className="font-medium text-green-700">R$ {item.valor.toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Top 5 Despesas</h4>
                  <div className="space-y-2">
                    {[
                      {nome: "Folha de Pagamento", valor: 45000},
                      {nome: "Aluguel Escritório", valor: 12000},
                      {nome: "Fornecedores", valor: 18000},
                      {nome: "Marketing", valor: 8000},
                      {nome: "Infraestrutura TI", valor: 15000}
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <span className="text-sm">{item.nome}</span>
                        <span className="font-medium text-red-700">R$ {item.valor.toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resumo Anual */}
        <TabsContent value="anual" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Receitas 2024</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">R$ 1.2M</div>
                <p className="text-xs text-green-600 mt-1">+45% vs 2023</p>
              </CardContent>
            </Card>
            <Card className="border border-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Despesas 2024</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">R$ 820k</div>
                <p className="text-xs text-green-600 mt-1">+28% vs 2023</p>
              </CardContent>
            </Card>
            <Card className="border border-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-black/60">Lucro 2024</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">R$ 380k</div>
                <p className="text-xs text-black/50 mt-1">Margem de 32%</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-black/5">
            <CardHeader>
              <CardTitle>Evolução Anual</CardTitle>
              <CardDescription>Comparativo dos últimos 3 anos</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={[
                  {ano: '2022', receitas: 650000, despesas: 480000, lucro: 170000},
                  {ano: '2023', receitas: 850000, despesas: 640000, lucro: 210000},
                  {ano: '2024', receitas: 1200000, despesas: 820000, lucro: 380000},
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ano" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="receitas" fill="hsl(var(--chart-success))" name="Receitas" />
                  <Bar dataKey="despesas" fill="hsl(var(--chart-danger))" name="Despesas" />
                  <Bar dataKey="lucro" fill="hsl(var(--chart-primary))" name="Lucro" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-black/5">
              <CardHeader>
                <CardTitle>Distribuição Anual de Receitas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        {name: 'Q1', value: 250000, color: 'hsl(var(--chart-accent-1))'},
                        {name: 'Q2', value: 320000, color: 'hsl(var(--chart-accent-2))'},
                        {name: 'Q3', value: 280000, color: 'hsl(var(--chart-accent-3))'},
                        {name: 'Q4', value: 350000, color: 'hsl(var(--chart-primary))'},
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        {name: 'Q1', value: 250000, color: 'hsl(var(--chart-accent-1))'},
                        {name: 'Q2', value: 320000, color: 'hsl(var(--chart-accent-2))'},
                        {name: 'Q3', value: 280000, color: 'hsl(var(--chart-accent-3))'},
                        {name: 'Q4', value: 350000, color: 'hsl(var(--chart-primary))'},
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-black/5">
              <CardHeader>
                <CardTitle>Metas 2024</CardTitle>
                <CardDescription>Progresso das metas anuais</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Meta de Receita</span>
                      <span className="text-sm font-medium">R$ 1.5M</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full" style={{width: '80%'}}></div>
                    </div>
                    <p className="text-xs text-black/60">80% concluído (R$ 1.2M)</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Meta de Lucro</span>
                      <span className="text-sm font-medium">R$ 500k</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-blue-500 h-3 rounded-full" style={{width: '76%'}}></div>
                    </div>
                    <p className="text-xs text-black/60">76% concluído (R$ 380k)</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Redução de Custos</span>
                      <span className="text-sm font-medium">15%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-orange-500 h-3 rounded-full" style={{width: '60%'}}></div>
                    </div>
                    <p className="text-xs text-black/60">60% concluído (9% reduzido)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="receitas" className="mt-6">
          <Receitas />
        </TabsContent>
        
        <TabsContent value="despesas" className="mt-6">
          <Despesas />
        </TabsContent>
      </Tabs>
    </div>
  );
}

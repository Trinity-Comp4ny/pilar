import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronDown, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";

// Importar dados do dashboard
import {
  receitasDataDiario,
  receitasDataMensal,
  receitasDataAnual,
  despesasDataDiario,
  despesasDataMensal,
  despesasDataAnual,
  fluxoCaixaDataDiario,
  fluxoCaixaDataMensal,
  fluxoCaixaDataAnual,
  receitasCategoriaDataDiario,
  receitasCategoriaDataMensal,
  receitasCategoriaDataAnual,
  despesasCategoriaDataDiario,
  despesasCategoriaDataMensal,
  despesasCategoriaDataAnual,
  receitasFormaPagtoDataDiario,
  receitasFormaPagtoDataMensal,
  receitasFormaPagtoDataAnual,
  despesasFormaPagtoDataDiario,
  despesasFormaPagtoDataMensal,
  despesasFormaPagtoDataAnual,
  despesasFornecedorDataDiario,
  despesasFornecedorDataMensal,
  despesasFornecedorDataAnual,
  projetosData,
  projetosStatusData,
  projetosTimelineData,
  clientesData,
  clientesTipoData,
  clientesRecorrenciaData,
  funcionariosData,
  funcionariosTempoData,
  funcionariosCustoData
} from "@/data/dashboardData";

export default function Dashboard() {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [viewType, setViewType] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [tipoGrafico, setTipoGrafico] = useState<"receitas" | "despesas">("receitas");
  
  // Funções para selecionar os dados corretos com base no tipo de visualização
  const getReceitasDespesasData = (tipo?: "receitas" | "despesas") => {
    const tipoAtual = tipo || tipoGrafico;
    
    if (tipoAtual === "receitas") {
      switch (viewType) {
        case "daily":
          return receitasDataDiario;
        case "monthly":
          return receitasDataMensal;
        case "yearly":
          return receitasDataAnual;
        default:
          return receitasDataMensal;
      }
    } else {
      switch (viewType) {
        case "daily":
          return despesasDataDiario;
        case "monthly":
          return despesasDataMensal;
        case "yearly":
          return despesasDataAnual;
        default:
          return despesasDataMensal;
      }
    }
  };

  const getCategoriaData = () => {
    if (tipoGrafico === "receitas") {
      switch (viewType) {
        case "daily":
          return receitasCategoriaDataDiario;
        case "monthly":
          return receitasCategoriaDataMensal;
        case "yearly":
          return receitasCategoriaDataAnual;
        default:
          return receitasCategoriaDataMensal;
      }
    } else {
      switch (viewType) {
        case "daily":
          return despesasCategoriaDataDiario;
        case "monthly":
          return despesasCategoriaDataMensal;
        case "yearly":
          return despesasCategoriaDataAnual;
        default:
          return despesasCategoriaDataMensal;
      }
    }
  };
  
  const getFormaPagtoData = () => {
    if (tipoGrafico === "receitas") {
      switch (viewType) {
        case "daily":
          return receitasFormaPagtoDataDiario;
        case "monthly":
          return receitasFormaPagtoDataMensal;
        case "yearly":
          return receitasFormaPagtoDataAnual;
        default:
          return receitasFormaPagtoDataMensal;
      }
    } else {
      switch (viewType) {
        case "daily":
          return despesasFormaPagtoDataDiario;
        case "monthly":
          return despesasFormaPagtoDataMensal;
        case "yearly":
          return despesasFormaPagtoDataAnual;
        default:
          return despesasFormaPagtoDataMensal;
      }
    }
  };

  const getFornecedorData = () => {
    switch (viewType) {
      case "daily":
        return despesasFornecedorDataDiario;
      case "monthly":
        return despesasFornecedorDataMensal;
      case "yearly":
        return despesasFornecedorDataAnual;
      default:
        return despesasFornecedorDataMensal;
    }
  };

  const getFluxoCaixaData = () => {
    switch (viewType) {
      case "daily":
        return fluxoCaixaDataDiario;
      case "monthly":
        return fluxoCaixaDataMensal;
      case "yearly":
        return fluxoCaixaDataAnual;
      default:
        return fluxoCaixaDataMensal;
    }
  };

  // Cálculo dos dados financeiros com base nas seleções atuais
  const calcularDados = () => {
    const financial = getReceitasDespesasData();
    const categoria = getCategoriaData();
    const formaPagto = getFormaPagtoData();
    const fornecedor = getFornecedorData();
    const fluxoCaixa = getFluxoCaixaData();
    
    const receitasTotal = fluxoCaixa.reduce((acc, curr) => acc + curr.receitas, 0);
    const despesasTotal = fluxoCaixa.reduce((acc, curr) => acc + curr.despesas, 0);
    const lucroTotal = receitasTotal - despesasTotal;
    
    return {
      financial,
      categoria,
      formaPagto,
      fornecedor,
      fluxoCaixa,
      receitasTotal,
      despesasTotal,
      lucroTotal
    };
  };
  
  const {
    financial: financialData,
    categoria: categoriaData,
    formaPagto: formaPagtoData,
    fornecedor: fornecedorData,
    fluxoCaixa: fluxoCaixaData,
    receitasTotal: totalReceitas,
    despesasTotal: totalDespesas,
    lucroTotal: lucro
  } = calcularDados();

  return (
    <div className="space-y-6">
      {/* Cabeçalho com título e filtros */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral dos indicadores financeiros</p>
        </div>
        
        <div className="flex gap-4 items-center">
          {/* Seletores de data */}
          <div className="flex gap-2">
            <div className="grid gap-2">
              <Label htmlFor="date-from">De:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-from"
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="date-to">Até:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-to"
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Seletor de visualização (diária, mensal, anual) */}
          <Select value={viewType} onValueChange={(value) => setViewType(value as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Visualização" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Diário</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card className="vrz-card space-y-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold">Receitas</CardTitle>
              <CardDescription>Total no período</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <LineChartIcon className="h-5 w-5 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceitas)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {viewType === "daily" ? "Hoje" : viewType === "monthly" ? "Neste mês" : "Neste ano"}
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card space-y-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold">Despesas</CardTitle>
              <CardDescription>Total no período</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-red-500" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {viewType === "daily" ? "Hoje" : viewType === "monthly" ? "Neste mês" : "Neste ano"}
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card space-y-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold">Lucro</CardTitle>
              <CardDescription>Receitas - Despesas</CardDescription>
            </div>
            <div className={`h-10 w-10 rounded-full ${lucro >= 0 ? "bg-green-500/20" : "bg-red-500/20"} flex items-center justify-center`}>
              <PieChartIcon className={`h-5 w-5 ${lucro >= 0 ? "text-green-500" : "text-red-500"}`} />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className={`text-2xl font-bold ${lucro >= 0 ? "text-green-600" : "text-red-600"}`}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucro)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {viewType === "daily" ? "Hoje" : viewType === "monthly" ? "Neste mês" : "Neste ano"}
            </p>
          </CardContent>
        </Card>

        <Card className="vrz-card space-y-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold">Projetos</CardTitle>
              <CardDescription>Projetos ativos</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground mt-2">3 novos este mês</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Gráficos principais */}
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {/* Gráfico de Receitas/Despesas */}
        <Card className="vrz-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>
                {tipoGrafico === "receitas" ? "Receitas" : "Despesas"} por Período
                {viewType === "daily" ? " (Diário)" : viewType === "monthly" ? " (Mensal)" : " (Anual)"}
              </CardTitle>
              <CardDescription>
                {viewType === "daily" ? "Valores diários" : viewType === "monthly" ? "Valores mensais" : "Valores anuais"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-28 justify-between text-xs">
                    {tipoGrafico === "receitas" ? "Receitas" : "Despesas"}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-28">
                  <DropdownMenuItem onClick={() => setTipoGrafico("receitas")}>Receitas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTipoGrafico("despesas")}>Despesas</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
                <XAxis dataKey="periodo" tick={{ fill: '#c7c7c7' }} />
                <YAxis tick={{ fill: '#c7c7c7' }} />
                <RechartsTooltip 
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`]} 
                  contentStyle={{ backgroundColor: '#1c1c1c', borderColor: '#333', color: '#fff' }} 
                />
                <Bar 
                  dataKey="valor" 
                  fill="#F97316" 
                  radius={[4, 4, 0, 0]}
                  name={tipoGrafico === "receitas" ? "Receitas" : "Despesas"} 
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Fluxo de Caixa */}
        <Card className="vrz-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>
                Fluxo de Caixa
                {viewType === "daily" ? " (Diário)" : viewType === "monthly" ? " (Mensal)" : " (Anual)"}
              </CardTitle>
              <CardDescription>Receitas, despesas e saldo</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={fluxoCaixaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
                <XAxis dataKey="periodo" tick={{ fill: '#c7c7c7' }} />
                <YAxis tick={{ fill: '#c7c7c7' }} />
                <RechartsTooltip 
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`]} 
                  contentStyle={{ backgroundColor: '#1c1c1c', borderColor: '#333', color: '#fff' }} 
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="receitas" 
                  stackId="1" 
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.6} 
                  name="Receitas" 
                />
                <Area 
                  type="monotone" 
                  dataKey="despesas" 
                  stackId="2" 
                  stroke="#ef4444" 
                  fill="#ef4444" 
                  fillOpacity={0.6} 
                  name="Despesas" 
                />
                <Area 
                  type="monotone" 
                  dataKey="saldo" 
                  stackId="3" 
                  stroke="#F97316" 
                  fill="#F97316" 
                  fillOpacity={0.8} 
                  name="Saldo" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Gráficos de detalhes */}
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {/* Gráfico de Categorias */}
        <Card className="vrz-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>
                {tipoGrafico === "receitas" ? "Receitas" : "Despesas"} por Categoria
                {viewType === "daily" ? " (Diário)" : viewType === "monthly" ? " (Mensal)" : " (Anual)"}
              </CardTitle>
              <CardDescription>Distribuição por categoria</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-28 justify-between text-xs">
                    {tipoGrafico === "receitas" ? "Receitas" : "Despesas"}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-28">
                  <DropdownMenuItem onClick={() => setTipoGrafico("receitas")}>Receitas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTipoGrafico("despesas")}>Despesas</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoriaData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ categoria, percent }) => `${categoria} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#F97316"
                  dataKey="valor"
                >
                  {categoriaData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.cor || (tipoGrafico === "receitas" ? 
                        `hsl(${24 + index * 10}, 90%, ${50 - index * 3}%)` : 
                        `hsl(${0 + index * 20}, 70%, ${40 + index * 3}%)`)} 
                    />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`]} 
                  contentStyle={{ backgroundColor: '#1c1c1c', borderColor: '#333', color: '#fff' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Forma de Pagamento */}
        <Card className="vrz-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>
                Formas de Pagamento
                {viewType === "daily" ? " (Diário)" : viewType === "monthly" ? " (Mensal)" : " (Anual)"}
              </CardTitle>
              <CardDescription>Distribuição por forma de pagamento</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-28 justify-between text-xs">
                    {tipoGrafico === "receitas" ? "Receitas" : "Despesas"}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-28">
                  <DropdownMenuItem onClick={() => setTipoGrafico("receitas")}>Receitas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTipoGrafico("despesas")}>Despesas</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={formaPagtoData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ formaPagto, percent }) => `${formaPagto} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#F97316"
                  dataKey="valor"
                >
                  {formaPagtoData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.cor || `hsl(${200 + index * 40}, 70%, ${40 + index * 3}%)`} 
                    />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`]} 
                  contentStyle={{ backgroundColor: '#1c1c1c', borderColor: '#333', color: '#fff' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Fornecedores */}
      <Card className="vrz-card mb-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>
              Despesas por Fornecedor
              {viewType === "daily" ? " (Diário)" : viewType === "monthly" ? " (Mensal)" : " (Anual)"}
            </CardTitle>
            <CardDescription>Principais fornecedores</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={fornecedorData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
              <XAxis 
                type="number" 
                tick={{ fill: '#c7c7c7' }} 
              />
              <YAxis 
                dataKey="fornecedor" 
                type="category" 
                tick={{ fill: '#c7c7c7' }} 
                width={110} 
              />
              <RechartsTooltip 
                formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`]} 
                contentStyle={{ backgroundColor: '#1c1c1c', borderColor: '#333', color: '#fff' }} 
              />
              <Bar 
                dataKey="valor" 
                fill="#F97316" 
                radius={[0, 4, 4, 0]}
                name="Valor" 
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

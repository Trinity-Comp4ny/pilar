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
  // Retorna os dados de receitas/despesas conforme o tipo de visualização
  const getReceitasDespesasData = () => {
    // Esta função não é mais usada diretamente para obter dados brutos
    // Apenas para manter compatibilidade com código existente
    return [];
  };

  const getCategoriaData = () => {
    // Selecionamos o conjunto de dados com base no tipo de gráfico (receitas/despesas)
    // e no tipo de visualização (diário/mensal/anual)
    // Mas para categorias não temos dados diários com datas específicas para filtrar
    // Então apenas selecionamos o conjunto correto baseado no viewType
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

  // Essa função obtém todos os dados base no formato diário (mais detalhado)
  // para que possamos aplicar filtros de data de forma consistente
  const obterDadosBase = () => {
    // Independente da visualização selecionada (diária, mensal ou anual),
    // usamos os dados diários como base para filtrar por data
    return {
      receitas: receitasDataDiario,
      despesas: despesasDataDiario,
      fluxoCaixa: fluxoCaixaDataDiario
    };
  };
  
  // Função para converter string de data no formato "DD/MM" para objeto Date
  const parsePeriodo = (periodo) => {
    // Formato "DD/MM"
    const [dia, mes] = periodo.split("/").map(Number);
    return new Date(new Date().getFullYear(), mes - 1, dia);
  };

  // Função para filtrar dados por período selecionado
  const filtrarPorData = (dados) => {
    // Se não tiver datas selecionadas, retorna todos os dados
    if (!dateFrom && !dateTo) {
      // Quando não há filtro de data, somamos todos os valores
      return dados;
    }
    
    return dados.filter(item => {
      const dataItem = parsePeriodo(item.periodo);
      
      // Verificar filtro de data inicial
      const passaFiltroInicial = !dateFrom || dataItem >= dateFrom;
      
      // Verificar filtro de data final
      const passaFiltroFinal = !dateTo || dataItem <= dateTo;
      
      return passaFiltroInicial && passaFiltroFinal;
    });
  };

  // Função para agrupar dados filtrados por período conforme o tipo de visualização
  // Esta função só será usada para gráficos que possuem eixo de data
  const agruparDadosPorPeriodo = (dados, tipoAgrupamento) => {
    if (tipoAgrupamento === "daily") {
      // Para visualização diária, usamos os dados como estão
      return dados;
    }
    
    // Para mensal ou anual, precisamos agrupar
    const agrupados = {};
    
    dados.forEach(item => {
      let chaveAgrupamento;
      const dataItem = parsePeriodo(item.periodo);
      
      if (tipoAgrupamento === "monthly") {
        // Formatar como "Jan", "Fev", etc
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        chaveAgrupamento = meses[dataItem.getMonth()];
      } else { // yearly
        chaveAgrupamento = dataItem.getFullYear().toString();
      }
      
      // Inicializar o grupo se não existir
      if (!agrupados[chaveAgrupamento]) {
        if ('valor' in item) {
          // Para dados simples (receitas, despesas)
          agrupados[chaveAgrupamento] = { periodo: chaveAgrupamento, valor: 0 };
        } else if ('receitas' in item && 'despesas' in item) {
          // Para fluxo de caixa
          agrupados[chaveAgrupamento] = { 
            periodo: chaveAgrupamento, 
            receitas: 0, 
            despesas: 0,
            saldo: 0
          };
        }
      }
      
      // Somar os valores no grupo
      if ('valor' in item) {
        agrupados[chaveAgrupamento].valor += item.valor;
      } else if ('receitas' in item && 'despesas' in item) {
        agrupados[chaveAgrupamento].receitas += item.receitas;
        agrupados[chaveAgrupamento].despesas += item.despesas;
        agrupados[chaveAgrupamento].saldo = agrupados[chaveAgrupamento].receitas - agrupados[chaveAgrupamento].despesas;
      }
    });
    
    // Converter o objeto de volta para array
    return Object.values(agrupados);
  };
  
  // Função para somar todos os valores quando o filtro está vazio
  const somarTotais = (dados) => {
    if (!dateFrom && !dateTo) {
      // Se não há filtro de data, somamos todos os valores
      // Isso afeta apenas os gráficos de categoria, forma de pagamento e fornecedor
      
      if (dados.length === 0) return [];
      
      if ('categoria' in dados[0]) {
        // Para dados de categoria, somente somar valores de mesma categoria
        const porCategoria = {};
        dados.forEach(item => {
          if (!porCategoria[item.categoria]) {
            porCategoria[item.categoria] = { ...item, valor: 0 };
          }
          porCategoria[item.categoria].valor += item.valor;
        });
        return Object.values(porCategoria);
      } else if ('forma' in dados[0]) {
        // Para dados de forma de pagamento, somente somar valores de mesma forma
        const porForma = {};
        dados.forEach(item => {
          if (!porForma[item.forma]) {
            porForma[item.forma] = { ...item, valor: 0 };
          }
          porForma[item.forma].valor += item.valor;
        });
        return Object.values(porForma);
      } else if ('fornecedor' in dados[0]) {
        // Para dados de fornecedor, somente somar valores de mesmo fornecedor
        const porFornecedor = {};
        dados.forEach(item => {
          if (!porFornecedor[item.fornecedor]) {
            porFornecedor[item.fornecedor] = { ...item, valor: 0 };
          }
          porFornecedor[item.fornecedor].valor += item.valor;
        });
        return Object.values(porFornecedor);
      }
    }
    
    // Se há filtro de data ou não é um tipo de dado que podemos somar, retorna os dados originais
    return dados;
  };

  // Cálculo dos dados financeiros com base nas seleções atuais
  const calcularDados = () => {
    // Obtemos os dados base no formato diário para poder filtrar por data
    const dadosBase = obterDadosBase();
    
    // Aplicamos os filtros de data aos dados diários (mais granulares)
    const receitasFiltradas = filtrarPorData(dadosBase.receitas);
    const despesasFiltradas = filtrarPorData(dadosBase.despesas);
    const fluxoCaixaFiltrado = filtrarPorData(dadosBase.fluxoCaixa);
    
    // SÓ aplicamos o tipo de visualização (diário/mensal/anual) aos gráficos que têm eixo de data
    // como o gráfico de Receitas por Período e Fluxo de Caixa
    const financial = tipoGrafico === "receitas" 
      ? agruparDadosPorPeriodo(receitasFiltradas, viewType)
      : agruparDadosPorPeriodo(despesasFiltradas, viewType);
      
    const fluxoCaixa = agruparDadosPorPeriodo(fluxoCaixaFiltrado, viewType);
    
    // Para os outros gráficos, vamos filtrá-los por data quando possível
    // Ou aplicar soma total quando o filtro de data estiver vazio
    // Pegamos os dados base conforme o viewType apenas para manter a mesma estrutura
    let categoriaBase = getCategoriaData();
    let formaPagtoBase = getFormaPagtoData();
    let fornecedorBase = getFornecedorData();
    
    // Aplicamos a soma de valores quando o filtro estiver vazio
    // Ou mantemos os valores como estão (sem agrupamento por período)
    const categoria = somarTotais(categoriaBase);
    const formaPagto = somarTotais(formaPagtoBase);
    const fornecedor = somarTotais(fornecedorBase);
    
    // Calcular totais baseados nos dados filtrados e agrupados
    // Os totais são somados a partir do fluxo de caixa já filtrado
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
    <div className="space-y-8">
      {/* Cabeçalho com título e filtros */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Dashboard</h1>
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
          <div className="grid gap-2">
            <Label htmlFor="view-type">Visualização:</Label>
            <Select value={viewType} onValueChange={(value) => setViewType(value as any)}>
              <SelectTrigger id="view-type" className="w-[180px]">
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
      </div>
      
      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border border-black/10 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-3">
            <CardTitle className="text-sm font-medium tracking-tight text-black/70">Receitas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold tracking-tight text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceitas)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/10 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-3">
            <CardTitle className="text-sm font-medium tracking-tight text-black/70">Despesas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold tracking-tight text-red-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/10 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-3">
            <CardTitle className="text-sm font-medium tracking-tight text-black/70">Saldo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className={`text-2xl font-semibold tracking-tight ${lucro >= 0 ? "text-green-600" : "text-red-600"}`}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucro)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/10 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-3">
            <CardTitle className="text-sm font-medium tracking-tight text-black/70">Projetos Ativos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold tracking-tight">12</div>

          </CardContent>
        </Card>
      </div>
      
      {/* Gráficos principais */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Receitas/Despesas */}
        <Card className="rounded-2xl border border-black/10 bg-white p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">
                {tipoGrafico === "receitas" ? "Receitas" : "Despesas"} por Período
              </CardTitle>
              <CardDescription className="text-sm text-black/60 mt-1">
                {viewType === "daily" ? "Diário" : viewType === "monthly" ? "Mensal" : "Anual"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-28 justify-between text-xs rounded-full border-black/10">
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
          <CardContent className="p-0">
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
                  fill={tipoGrafico === "receitas" ? "#22c55e" : "#ef4444"} 
                  radius={[4, 4, 0, 0]}
                  name={tipoGrafico === "receitas" ? "Receitas" : "Despesas"} 
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Fluxo de Caixa */}
        <Card className="rounded-2xl border border-black/10 bg-white p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">
                Fluxo de Caixa
              </CardTitle>
              <CardDescription className="text-sm text-black/60 mt-1">{viewType === "daily" ? "Diário" : viewType === "monthly" ? "Mensal" : "Anual"}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
                  stroke="#22c55e" 
                  fill="#22c55e" 
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
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.8} 
                  name="Saldo" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Gráficos de detalhes */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Categorias */}
        <Card className="rounded-2xl border border-black/10 bg-white p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">
                {tipoGrafico === "receitas" ? "Receitas" : "Despesas"} por Categoria
              </CardTitle>
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
                  fill="hsl(var(--primary))"
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
        <Card className="rounded-2xl border border-black/10 bg-white p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">
                Formas de Pagamento
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-28 justify-between text-xs rounded-full border-black/10">
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
          <CardContent className="p-0">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={formaPagtoData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ formaPagto, percent }) => `${formaPagto} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
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
      <Card className="rounded-2xl border border-black/10 bg-white p-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-4">
          <div>
            <CardTitle className="text-lg font-medium tracking-tight">
              Despesas por Fornecedor
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
                fill="hsl(var(--primary))" 
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

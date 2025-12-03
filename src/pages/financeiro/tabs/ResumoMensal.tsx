import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { chartDataDiario } from "../data/mockData";
import { CustomTooltip } from "../components/CustomTooltip";

export default function ResumoMensal() {
  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        <Card className="vrz-card bg-green-50 border-green-100 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">R$ 145.000</div>
            <p className="text-xs text-green-600 mt-1 flex items-center">
              <ArrowUpRight size={12} className="mr-1" />
              12.5% vs mês anterior
            </p>
          </CardContent>
        </Card>
        <Card className="vrz-card bg-red-50 border-red-100 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">R$ 98.000</div>
            <p className="text-xs text-green-600 mt-1 flex items-center">
              <ArrowDownRight size={12} className="mr-1" />
              8.2% vs mês anterior
            </p>
          </CardContent>
        </Card>
        <Card className="vrz-card bg-blue-50 border-blue-100 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Lucro Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">R$ 47.000</div>
            <p className="text-xs text-blue-600 mt-1">Margem de 32%</p>
          </CardContent>
        </Card>
        <Card className="vrz-card border-black/5 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-black/60">Projeção Final</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black/80">R$ 52.000</div>
            <p className="text-xs text-black/50 mt-1">Baseado na média</p>
          </CardContent>
        </Card>
      </div>

      <Card className="vrz-card w-full">
        <CardHeader>
          <CardTitle>Performance Diária</CardTitle>
          <CardDescription>Acompanhamento do mês corrente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataDiario}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="dia" stroke="#888" axisLine={false} tickLine={false} />
                <YAxis stroke="#888" axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="receitas" stackId="1" stroke="hsl(var(--chart-success))" fill="hsl(var(--chart-success))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="despesas" stackId="2" stroke="hsl(var(--chart-danger))" fill="hsl(var(--chart-danger))" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento de Receitas e Despesas do Mês */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Principais Receitas do Mês
            </CardTitle>
            <CardDescription>Top 5 entradas de receita</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { nome: 'Projeto Residencial XYZ - Pagamento 2/3', valor: 28500, data: '15/11' },
                { nome: 'Consultoria Empresa A', valor: 18000, data: '10/11' },
                { nome: 'Edifício Comercial ABC - Sinal', valor: 15000, data: '05/11' },
                { nome: 'Auditoria Técnica Condomínio', valor: 10000, data: '20/11' },
                { nome: 'Reforma Shopping - Fase 1', valor: 8500, data: '25/11' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100 hover:bg-green-100 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.nome}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.data}</p>
                  </div>
                  <span className="text-sm font-bold text-green-700">R$ {item.valor.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total das 5 principais</span>
                <span className="text-lg font-bold text-green-600">R$ 80.000</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="vrz-card w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Principais Despesas do Mês
            </CardTitle>
            <CardDescription>Top 5 saídas de despesa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { nome: 'Folha de Pagamento - Novembro', valor: 35000, data: '05/11', categoria: 'Pessoal' },
                { nome: 'Aluguel Escritório', valor: 12000, data: '10/11', categoria: 'Operacional' },
                { nome: 'Fornecedor Materials - Obra XYZ', valor: 8500, data: '15/11', categoria: 'Projetos' },
                { nome: 'Encargos e Benefícios', valor: 8000, data: '05/11', categoria: 'Pessoal' },
                { nome: 'Marketing Digital - Campanha', valor: 5000, data: '20/11', categoria: 'Marketing' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.nome}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.data} • {item.categoria}</p>
                  </div>
                  <span className="text-sm font-bold text-red-700">R$ {item.valor.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total das 5 principais</span>
                <span className="text-lg font-bold text-red-600">R$ 68.500</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

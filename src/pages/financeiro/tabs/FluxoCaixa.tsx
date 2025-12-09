import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line } from "recharts";
import { CustomTooltip } from "../components/CustomTooltip";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Loader2 } from "lucide-react";

interface FluxoCaixaProps {
  dateFrom?: Date;
  dateTo?: Date;
}

export default function FluxoCaixa({ dateFrom, dateTo }: FluxoCaixaProps) {
  const { data: dashboardData, isLoading } = useDashboardData(dateFrom, dateTo);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const chartData = dashboardData?.chartData || [];
  const hasData = chartData.some(item => item.receitas > 0 || item.despesas > 0);

  return (
    <div className="space-y-6 w-full max-w-none">
      <Card className="vrz-card w-full">
        <CardHeader>
          <CardTitle>Análise de Fluxo de Caixa</CardTitle>
          <CardDescription>Visualização detalhada do saldo acumulado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full relative">
            {!hasData && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                <p className="text-muted-foreground text-sm">Não possui registros de dados ainda</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="mes" stroke="#888" axisLine={false} tickLine={false} />
                <YAxis stroke="#888" axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="receitas" name="Entradas" fill="hsl(var(--chart-success))" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="despesas" name="Saídas" fill="hsl(var(--chart-danger))" radius={[4, 4, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey={(data) => data.receitas - data.despesas} name="Saldo Líquido" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

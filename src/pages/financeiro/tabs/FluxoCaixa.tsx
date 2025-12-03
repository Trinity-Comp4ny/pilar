import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line } from "recharts";
import { chartDataMensal } from "../data/mockData";
import { CustomTooltip } from "../components/CustomTooltip";

export default function FluxoCaixa() {
  return (
    <div className="space-y-6 w-full max-w-none">
      <Card className="vrz-card w-full">
        <CardHeader>
          <CardTitle>Análise de Fluxo de Caixa</CardTitle>
          <CardDescription>Visualização detalhada do saldo acumulado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartDataMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="mes" stroke="#888" axisLine={false} tickLine={false} />
                <YAxis stroke="#888" axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="receitas" name="Entradas" fill="hsl(var(--chart-success))" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="despesas" name="Saídas" fill="hsl(var(--chart-danger))" radius={[4, 4, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="saldo" name="Saldo Líquido" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

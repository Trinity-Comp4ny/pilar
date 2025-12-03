import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Meta {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string;
  categoria: "receita" | "lucro" | "economia" | "investimento";
}

// Mock data - em produção, isso viria de um contexto ou prop
const metas: Meta[] = [
  {
    id: "1",
    nome: "Faturamento Anual",
    alvo: 1500000,
    atual: 1200000,
    prazo: "2024-12-31",
    categoria: "receita"
  },
  {
    id: "2",
    nome: "Margem de Lucro Líquido",
    alvo: 500000,
    atual: 380000,
    prazo: "2024-12-31",
    categoria: "lucro"
  },
  {
    id: "3",
    nome: "Fundo de Reserva",
    alvo: 100000,
    atual: 45000,
    prazo: "2024-12-31",
    categoria: "investimento"
  }
];

export default function MetasSummary() {
  const navigate = useNavigate();

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500";
    if (percent >= 75) return "bg-blue-500";
    if (percent >= 50) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <Card className="vrz-card w-full h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Metas Financeiras
          </CardTitle>
          <CardDescription className="mt-1">Progresso das suas principais metas</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/financeiro')}
          className="text-xs rounded-full"
        >
          Ver Todas
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {metas.map((meta) => {
          const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
          return (
            <div key={meta.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{meta.nome}</span>
                <span className="text-sm font-bold">{percent}%</span>
              </div>
              <Progress value={percent} className="h-2" indicatorClassName={getProgressColor(percent)} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>R$ {(meta.atual / 1000).toFixed(0)}k</span>
                <span>R$ {(meta.alvo / 1000).toFixed(0)}k</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

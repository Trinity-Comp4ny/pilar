import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface FolhaSummaryCardsProps {
  totalFolha: number;
  peopleCount: number;
  totalUniqueArea: number;
}

export function FolhaSummaryCards({ totalFolha, peopleCount, totalUniqueArea }: FolhaSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total da Folha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalFolha)}</div>
          <p className="text-xs text-muted-foreground mt-1">Soma de salários fixos + variáveis</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pessoas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{peopleCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Colaboradores listados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Área Projetada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUniqueArea.toLocaleString("pt-BR")} m²</div>
          <p className="text-xs text-muted-foreground mt-1">Soma da área de projetos únicos</p>
        </CardContent>
      </Card>
    </div>
  );
}

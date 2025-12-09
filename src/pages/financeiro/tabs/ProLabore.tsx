import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wallet } from "lucide-react";

interface ProLaboreData {
  pessoa_id: string;
  pessoa_nome: string;
  cargo: string;
  salario_fixo: number;
  valor_m2: number;
  qtd_projetos: number;
  total_area_m2: number;
  total_comissao: number;
  total_receber: number;
}

export default function ProLabore() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pro-labore'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('view_pro_labore') as any).select('*');
      if (error) throw error;
      return data as ProLaboreData[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        Erro ao carregar dados de pró-labore.
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <Card className="vrz-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Pró-Labore e Comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Salário Fixo</TableHead>
                  <TableHead className="text-right">Valor m²</TableHead>
                  <TableHead className="text-center">Qtd. Projetos</TableHead>
                  <TableHead className="text-right">Total Área (m²)</TableHead>
                  <TableHead className="text-right">Comissão (m²)</TableHead>
                  <TableHead className="text-right font-bold">Total a Receber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum dado encontrado. Certifique-se de ter pessoas vinculadas a projetos ativos.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.map((item) => (
                    <TableRow key={item.pessoa_id}>
                      <TableCell className="font-medium">{item.pessoa_nome}</TableCell>
                      <TableCell>{item.cargo || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.salario_fixo)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valor_m2)}</TableCell>
                      <TableCell className="text-center">{item.qtd_projetos}</TableCell>
                      <TableCell className="text-right">{item.total_area_m2.toFixed(2)} m²</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(item.total_comissao)}</TableCell>
                      <TableCell className="text-right font-bold text-green-700">{formatCurrency(item.total_receber)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

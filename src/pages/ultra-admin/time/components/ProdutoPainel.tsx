import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Decisao } from "../lib";
import { ListaDecisoes } from "./ListaDecisoes";

/**
 * Ficha do Produto (SPEC 130): as tarefas da semana que o agente grava toda segunda. Os
 * números por área aparecem no briefing; painel próprio de adoção só depois do protótipo.
 */
export function ProdutoPainel({ decisoes }: { decisoes: Decisao[] }) {
  return (
    <Card className="border border-black/5">
      <CardHeader className="pb-1">
        <CardTitle className="text-base">Tarefas da semana</CardTitle>
      </CardHeader>
      <CardContent>
        <ListaDecisoes decisoes={decisoes} vazio="Nenhuma área perdendo escritório e nenhum bug parado na triagem." />
      </CardContent>
    </Card>
  );
}

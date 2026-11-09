import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Decisao } from "../lib";
import { ListaDecisoes } from "./ListaDecisoes";

/**
 * Ficha de agente sem painel próprio de números (Produto, SPEC 130; Qualidade, SPEC 131):
 * a fila do agente. Os números aparecem no briefing; painel próprio só depois do protótipo.
 */
export function TarefasDaArea({ titulo, vazio, decisoes }: { titulo: string; vazio: string; decisoes: Decisao[] }) {
  return (
    <Card className="border border-black/5">
      <CardHeader className="pb-1">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <ListaDecisoes decisoes={decisoes} vazio={vazio} />
      </CardContent>
    </Card>
  );
}

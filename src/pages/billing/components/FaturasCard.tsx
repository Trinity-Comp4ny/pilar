import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { useFaturas, type Fatura } from "../hooks/useFaturas";

/** "2026-11-17" -> "17/11/2026", sem passar por Date (evita deslocar o dia pelo fuso). */
export function dataDaFatura(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function situacao(f: Fatura): string {
  if (f.paga) return "Paga";
  if (f.status === "OVERDUE") return "Em atraso";
  if (f.status === "REFUNDED") return "Estornada";
  return "Em aberto";
}

// Recibos e faturas da assinatura, dentro do Pilar. O comprovante em si é a página do Asaas.
export function FaturasCard({ enabled }: { enabled: boolean }) {
  const { data: faturas, isLoading, error } = useFaturas(enabled);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Faturas e recibos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-ink-muted">Carregando faturas...</p>
        ) : error ? (
          <p className="text-sm text-ink-muted">
            Não foi possível carregar as faturas agora. Tente novamente em instantes.
          </p>
        ) : !faturas?.length ? (
          <p className="text-sm text-ink-muted">Nenhuma cobrança até agora.</p>
        ) : (
          <ul className="divide-y divide-border">
            {faturas.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{dataDaFatura(f.payment_date ?? f.due_date)}</p>
                  <p className="text-xs text-ink-muted">{situacao(f)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-ink">{formatCurrency(f.value)}</span>
                  {f.url ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                        {f.paga ? "Recibo" : "Fatura"} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

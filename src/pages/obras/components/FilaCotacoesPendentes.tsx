import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ordenarCotacoesPendentes, urgenciaLabel } from "@/lib/obras";
import { useCotacoesPendentesEmpresa } from "@/hooks/useObraCotacoes";

const LIMITE = 5;

export function FilaCotacoesPendentes() {
  const { data: cotacoes = [] } = useCotacoesPendentesEmpresa();

  if (cotacoes.length === 0) return null;

  const ordenadas = ordenarCotacoesPendentes(cotacoes);
  const visiveis = ordenadas.slice(0, LIMITE);
  const restantes = ordenadas.length - visiveis.length;

  return (
    <Card className="rounded-2xl border border-black/5 bg-white">
      <CardContent className="space-y-3 p-4">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          Cotações aguardando decisão
        </h3>
        <ul className="divide-y divide-black/5">
          {visiveis.map((c) => {
            const atrasada = c.prazo_necessidade != null && urgenciaLabel(c.prazo_necessidade).startsWith("atrasada");
            return (
              <li key={c.id}>
                <Link
                  to={`/obras/${c.obra_id}?tab=cotacoes`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{c.descricao}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.obra_nome}</span>
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 text-xs ${
                      atrasada ? "text-danger-strong" : "text-muted-foreground"
                    }`}
                  >
                    {atrasada && <AlertTriangle className="h-3.5 w-3.5" />}
                    {urgenciaLabel(c.prazo_necessidade)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {restantes > 0 && (
          <Link
            to={`/obras/${ordenadas[LIMITE].obra_id}?tab=cotacoes`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            +{restantes} · ver todas
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

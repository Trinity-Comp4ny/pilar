import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { quandoRelativo } from "../../lib";
import type { OpsExecucao } from "../api";

/**
 * O que o agente escreveu na última execução: resumo e até três destaques. Quando o
 * modelo não respondeu (falha ou teto de custo), o briefing veio das regras e a tela diz.
 */
export function BriefingAgente({ execucao }: { execucao: OpsExecucao | null }) {
  const b = execucao?.briefing;
  return (
    <Card className="border border-black/5">
      <CardHeader className="pb-1">
        <CardTitle className="text-base">Briefing</CardTitle>
        {execucao && (
          <p className="text-xs text-ink-muted">
            {quandoRelativo(execucao.inicio) ?? "agora há pouco"}
            {b?.fonte === "regra"
              ? " · escrito pelas regras, sem IA nesta rodada"
              : " · escrito pela IA a partir dos números"}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!b ? (
          <EmptyState compact title='Ainda sem briefing. Use "Rodar agora" ou espere o próximo horário automático.' />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink">{b.resumo}</p>
            {b.destaques.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                {b.destaques.map((d) => (
                  <li key={`${d.texto}-${d.refs.join(",")}`}>{d.texto}</li>
                ))}
              </ul>
            )}
            {execucao?.erro && <p className="text-xs text-ink-muted">Motivo: {execucao.erro}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

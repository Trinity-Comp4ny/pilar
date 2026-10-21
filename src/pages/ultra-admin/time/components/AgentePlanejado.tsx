import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANO_DOS_AGENTES, type AgenteId } from "../lib";

/** Ficha de agente que ainda não roda: mostra o que ele vai medir e de onde vem o dado. */
export function AgentePlanejado({ id }: { id: AgenteId }) {
  const plano = PLANO_DOS_AGENTES[id];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border border-black/5">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">O que vai medir</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {plano.indicadores.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="border border-black/5">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">De onde vem o dado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {plano.fontes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">Entra em: {plano.quando}. Plano completo na SPEC 126.</p>
        </CardContent>
      </Card>
    </div>
  );
}

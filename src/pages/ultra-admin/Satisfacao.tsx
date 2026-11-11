import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PilarPage } from "@/components/PilarPage";
import { EmptyState } from "@/components/EmptyState";
import { KPICard } from "@/components/KPICard";
import { PageLoader } from "@/components/motion/PageLoader";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { calcularNps, DIA_MS, FLUXOS_CES, NPS_INTERVALO_DIAS } from "@/lib/pesquisas";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Linha {
  tipo: string;
  nota: number | null;
  dispensou: boolean;
  comentario: string | null;
  fluxo: string | null;
  created_at: string;
  empresas: { nome: string } | null;
}

// Voz do cliente (SPEC 156): NPS e esforço dos últimos 90 dias. Detrator também chega no sino
// na hora em que responde.
export default function Satisfacao() {
  usePageTitle("Satisfação · Ultra admin");
  const query = useQuery({
    queryKey: ["ultra-admin-satisfacao"],
    queryFn: async (): Promise<Linha[]> => {
      const desde = new Date(Date.now() - NPS_INTERVALO_DIAS * DIA_MS).toISOString();
      const { data, error } = await supabase
        .from("pesquisas_satisfacao")
        .select("tipo, nota, dispensou, comentario, fluxo, created_at, empresas(nome)")
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const linhas = useMemo(() => query.data ?? [], [query.data]);
  const nps = useMemo(
    () => calcularNps(linhas.filter((l) => l.tipo === "nps" && l.nota !== null).map((l) => l.nota as number)),
    [linhas]
  );
  const dispensas = linhas.filter((l) => l.tipo === "nps" && l.dispensou).length;
  const comentarios = linhas.filter((l) => l.tipo === "nps" && l.comentario);
  const ces = useMemo(
    () =>
      Object.entries(FLUXOS_CES).map(([fluxo, nome]) => {
        const r = linhas.filter((l) => l.tipo === "ces" && l.fluxo === fluxo && l.nota !== null);
        const faceis = r.filter((l) => l.nota === 1).length;
        return {
          fluxo,
          nome,
          respostas: r.length,
          faceis,
          pct: r.length ? Math.round((faceis / r.length) * 100) : null,
        };
      }),
    [linhas]
  );

  return (
    <PilarPage title="Satisfação">
      <p className="text-sm text-ink-muted">
        Últimos {NPS_INTERVALO_DIAS} dias. NPS = % de promotores (9 e 10) menos % de detratores (0 a 6).
      </p>
      {query.isLoading ? (
        <PageLoader label="Buscando respostas" />
      ) : query.error ? (
        <EmptyState title="Não foi possível carregar as respostas" description="Recarregue a página." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="NPS" value={nps.nps === null ? "-" : String(nps.nps)} />
            <KPICard label="Respostas" value={String(nps.respostas)} />
            <KPICard label="Detratores" value={String(nps.detratores)} />
            <KPICard label="Dispensaram" value={String(dispensas)} />
          </div>

          <Card>
            <CardContent className="space-y-3 pt-4">
              <h2 className="text-sm font-semibold text-ink">Foi fácil? (esforço por fluxo)</h2>
              <ul className="divide-y divide-black/5 text-sm">
                {ces.map((c) => (
                  <li key={c.fluxo} className="flex items-center justify-between py-2">
                    <span className="text-ink">{c.nome}</span>
                    <span className="text-ink-muted">
                      {c.pct === null ? "sem respostas" : `${c.pct}% fácil · ${c.respostas} respostas`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-4">
              <h2 className="text-sm font-semibold text-ink">O que pesou na nota</h2>
              {comentarios.length === 0 ? (
                <EmptyState compact title="Nenhum comentário ainda." />
              ) : (
                <ul className="divide-y divide-black/5">
                  {comentarios.map((c, i) => (
                    <li key={`${c.created_at}-${i}`} className="space-y-0.5 py-2.5 text-sm">
                      <p className="text-ink">{c.comentario}</p>
                      <p className="text-xs text-ink-muted">
                        {`Nota ${c.nota} · ${c.empresas?.nome ?? "escritório"} · ${formatDateTime(c.created_at)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PilarPage>
  );
}

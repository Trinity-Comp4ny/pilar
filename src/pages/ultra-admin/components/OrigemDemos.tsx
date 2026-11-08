import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";

const DIAS = 30;

const ROTULO_CANAL: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  claude: "Claude",
  copilot: "Copilot",
  google: "Google (busca)",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  x: "X",
  outro_site: "Outro site",
  direto: "Direto (sem origem)",
};

export type CanalContagem = { canal: string; rotulo: string; total: number };

/** Agrupa os cliques por canal, do mais frequente ao menos. */
export function agruparPorCanal(linhas: Array<{ canal: string }>): CanalContagem[] {
  const mapa = new Map<string, number>();
  for (const l of linhas) mapa.set(l.canal, (mapa.get(l.canal) ?? 0) + 1);
  return [...mapa.entries()]
    .map(([canal, total]) => ({ canal, rotulo: ROTULO_CANAL[canal] ?? canal, total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo));
}

function useOrigemDemos() {
  return useQuery({
    queryKey: ["ultra-admin", "demo-interesses", DIAS],
    staleTime: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("demo_interesses")
        .select("canal")
        .gte("created_at", desde)
        .limit(5000);
      if (error) throw error;
      return agruparPorCanal(data ?? []);
    },
  });
}

/**
 * De onde vêm os pedidos de demonstração (SPEC 149): cliques em "Agendar
 * demonstração" na landing nos últimos 30 dias, por canal (UTM ou site que
 * mandou o visitante). Mostra o topo do funil antes de virar empresa.
 */
export function OrigemDemos() {
  const q = useOrigemDemos();
  const canais = q.data ?? [];
  const total = canais.reduce((s, c) => s + c.total, 0);
  const maior = canais[0]?.total ?? 1;

  return (
    <Card className="border border-black/5">
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
        <CardTitle className="text-base">De onde vêm os pedidos de demonstração</CardTitle>
        <span className="text-xs text-ink-muted">
          {total} {total === 1 ? "clique" : "cliques"} em {DIAS} dias
        </span>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : q.isError ? (
          <EmptyState compact title="Não foi possível carregar os cliques." />
        ) : canais.length === 0 ? (
          <EmptyState compact title="Nenhum clique em Agendar demonstração neste período." />
        ) : (
          <ul className="grid gap-x-6 gap-y-1 md:grid-cols-2">
            {canais.map((c) => (
              <li key={c.canal} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-1.5">
                <span className="truncate text-sm text-ink">{c.rotulo}</span>
                <span className="text-sm font-medium tabular-nums text-ink">{c.total}</span>
                <span className="col-span-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-ink/60"
                    style={{ width: `${(c.total / maior) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

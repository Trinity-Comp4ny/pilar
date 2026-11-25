import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DIAS = 30;

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

/** Cliques em "Agendar demonstração" por canal nos últimos `dias` dias. */
export function useOrigemDemos(dias = DIAS, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["ultra-admin", "demo-interesses", dias],
    staleTime: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
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

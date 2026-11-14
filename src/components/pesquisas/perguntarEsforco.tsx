import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { podePerguntarEsforco } from "@/lib/pesquisas";
import { minhasRespostas } from "@/lib/pesquisasApi";
import { PerguntaEsforco } from "./PerguntaEsforco";

/**
 * Pergunta rápida de esforço (CES, SPEC 156) depois de um fluxo que deu certo. Amostra de 1 em 5
 * e no máximo uma vez a cada 30 dias por fluxo. Nunca atrapalha: qualquer falha só não pergunta.
 */
export async function perguntarEsforco(fluxo: string, sorteio: number = Math.random()): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return false;
    if (sorteio >= 0.2) return false;
    const respostas = await minhasRespostas(userId);
    if (!podePerguntarEsforco(fluxo, respostas, Date.now(), sorteio)) return false;
    const rota = window.location.pathname;
    // Depois do toast de sucesso do próprio fluxo, para não competir com ele.
    window.setTimeout(() => {
      toast.custom((id) => <PerguntaEsforco id={id} fluxo={fluxo} rota={rota} />, { duration: 15_000 });
    }, 1200);
    return true;
  } catch {
    return false;
  }
}

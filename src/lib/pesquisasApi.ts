import { supabase } from "@/integrations/supabase/client";
import { DIA_MS, NPS_INTERVALO_DIAS, type RespostaPropria } from "@/lib/pesquisas";

/** Respostas e dispensas do próprio usuário nos últimos 90 dias (limite de frequência). */
export async function minhasRespostas(userId: string): Promise<RespostaPropria[]> {
  const desde = new Date(Date.now() - NPS_INTERVALO_DIAS * DIA_MS).toISOString();
  const { data, error } = await supabase
    .from("pesquisas_satisfacao")
    .select("tipo, fluxo, created_at")
    .eq("created_by", userId)
    .gte("created_at", desde);
  if (error) throw error;
  return (data ?? []) as RespostaPropria[];
}

export type NovaResposta =
  | { tipo: "nps"; nota: number | null; comentario?: string | null; rota: string }
  | { tipo: "ces"; nota: 0 | 1 | null; fluxo: string; comentario?: string | null; rota: string };

/** Grava resposta (nota) ou dispensa (nota null). Melhor esforço: falhar não incomoda ninguém. */
export async function gravarResposta(r: NovaResposta): Promise<void> {
  try {
    await supabase.from("pesquisas_satisfacao").insert({
      tipo: r.tipo,
      nota: r.nota,
      dispensou: r.nota === null,
      comentario: r.comentario?.trim() || null,
      fluxo: r.tipo === "ces" ? r.fluxo : null,
      rota: r.rota.slice(0, 200),
    });
  } catch {
    // Sem rede: perde-se uma resposta, o trabalho da pessoa segue.
  }
}

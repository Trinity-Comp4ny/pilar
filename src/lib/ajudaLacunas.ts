import { supabase } from "@/integrations/supabase/client";

/**
 * Lacunas da ajuda (SPEC 155): pergunta que o agente não resolveu, ou busca da central sem
 * resultado, vira pauta de artigo no Ultra admin. Melhor esforço: falha não incomoda ninguém.
 * A mesma pergunta só é gravada uma vez por aba.
 */
const gravadas = new Set<string>();

export function normalizarPergunta(texto: string): string {
  return texto.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 300);
}

export async function registrarPerguntaSemResposta(
  texto: string,
  rota: string,
  origem: "agente" | "central"
): Promise<void> {
  const chave = normalizarPergunta(texto);
  if (chave.length < 2 || gravadas.has(chave)) return;
  gravadas.add(chave);
  try {
    await supabase.from("ajuda_perguntas_sem_resposta").insert({ texto: chave, rota: rota.slice(0, 200), origem });
  } catch {
    // Sem rede ou sem sessão: a pauta perde uma pergunta, ninguém perde trabalho.
  }
}

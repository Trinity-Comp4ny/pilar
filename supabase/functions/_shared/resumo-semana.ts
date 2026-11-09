// SPEC 135, fase C (BEZ-57): resumo da semana que o cliente vê no portal. Puro (sem rede e sem
// banco), para teste. A entrada é SÓ o texto dos registros que o gestor liberou ao cliente: o que
// o modelo recebe é, por construção, o que o cliente já pode ler. Efetivo, pendência, problema,
// autor e áudio nunca entram.

import { z } from "./schemas.ts";

/** Até quantos registros liberados entram no resumo, e o tamanho máximo de cada texto. */
export const MAX_REGISTROS_NO_RESUMO = 40;
export const MAX_TEXTO_REGISTRO = 600;
export const MAX_RESUMO = 600;
/** O resumo cobre os últimos 7 dias (hoje e os 6 anteriores). */
export const DIAS_DO_RESUMO = 7;

export interface RegistroLiberado {
  id: string;
  data_registro: string;
  texto_organizado: string | null;
  texto_bruto: string | null;
}

export interface FonteDoResumo {
  itens: Array<{ data: string; texto: string }>;
  hash: string;
}

export const resumoSchema = z.object({
  resumo: z.string().trim().min(1).max(MAX_RESUMO),
});

export const PROMPT_RESUMO_SEMANA = `Você escreve o resumo semanal de uma obra para o CLIENTE do escritório de engenharia.
Recebe os registros que o escritório liberou ao cliente nos últimos 7 dias, um por linha, com a data.
Regras:
- Escreva 2 a 3 frases em português do Brasil, tom direto e calmo, em terceira pessoa ("a laje foi concretada").
- Use SÓ o que está nos registros. Não invente serviço, prazo, número, nome nem causa.
- Não cite nomes de pessoas, quantidade de pessoas, fornecedores nem valores.
- Se os registros falarem de próximo passo, diga qual é. Se não falarem, não comente: nunca escreva que não há informação ou que algo não foi registrado.
- Sem lista, sem título, sem emoji, sem travessão.
Devolva JSON no formato {"resumo": "..."}.`;

/** Mensagem do usuário para o modelo: uma linha por registro liberado. */
export function mensagemResumoSemana(fonte: FonteDoResumo): string {
  return fonte.itens.map((i) => `${i.data}: ${i.texto}`).join("\n");
}

async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Monta a fonte do resumo a partir dos registros liberados. O hash identifica exatamente o que o
 * resumo cobre: se o gestor liberar, tirar ou corrigir um registro, o hash muda e o resumo é
 * refeito; se nada mudou, o resumo guardado vale.
 */
export async function montarFonte(registros: RegistroLiberado[]): Promise<FonteDoResumo> {
  const itens = registros
    .map((r) => ({
      id: r.id,
      data: r.data_registro,
      texto: (r.texto_organizado ?? r.texto_bruto ?? "").trim().slice(0, MAX_TEXTO_REGISTRO),
    }))
    .filter((i) => i.texto.length > 0)
    .sort((a, b) => (a.data === b.data ? a.id.localeCompare(b.id) : a.data.localeCompare(b.data)))
    .slice(-MAX_REGISTROS_NO_RESUMO);
  const hash = await sha256Hex(JSON.stringify(itens.map((i) => [i.id, i.texto])));
  return { itens: itens.map(({ data, texto }) => ({ data, texto })), hash };
}

/** Limpa o texto do modelo: espaços, travessão (regra de escrita do projeto) e aspas tipográficas. */
export function limparResumo(texto: string): string {
  return texto
    .replace(/\s+/g, " ")
    .replace(/\s*[—–]\s*/g, ", ")
    .trim();
}

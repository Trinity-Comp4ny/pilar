// SPEC 169: do que o modelo devolveu ao que vai para o banco. Aterra a citação, aplica o
// glossário e descarta o que não tem prova no texto. Função pura.
import { aterrar } from "./aterrar.ts";
import type { RespostaModelo } from "./prompt.ts";

export function numerarLinhas(texto: string): string {
  return texto
    .split("\n")
    .map((l, i) => `${i}| ${l}`)
    .join("\n");
}

export interface LinhasParaGravar {
  tipo: string;
  tipo_confianca: number;
  proximo_passo: string | null;
  proximo_passo_em: string | null;
  insights: Array<{
    categoria: string;
    texto: string;
    citacao: string;
    modulo_pilar: string | null;
    falante: string;
    texto_duvidoso: boolean;
  }>;
  segmentos: Array<{ tipo: string; inicio: number; fim: number; proporcao_ruido: number }>;
  compromissos: RespostaModelo["compromissos"];
  descartados: number;
}

export function montarLinhas(transcriptRedigido: string, r: RespostaModelo): LinhasParaGravar {
  const { aceitos, descartados, confianca } = aterrar(transcriptRedigido, r.insights);
  return {
    tipo: r.tipo,
    // A confiança do tipo cai junto quando o modelo inventou citação.
    tipo_confianca: Math.round(r.tipo_confianca * confianca * 100) / 100,
    proximo_passo: r.proximo_passo,
    proximo_passo_em: r.proximo_passo_em,
    insights: aceitos.map((i) => ({
      categoria: i.categoria,
      texto: i.texto,
      citacao: i.citacao,
      modulo_pilar: i.modulo_pilar,
      falante: i.falante,
      texto_duvidoso: i.texto_duvidoso,
    })),
    segmentos: r.segmentos.map((s) => ({
      tipo: s.tipo,
      inicio: Math.min(s.inicio_linha, s.fim_linha),
      fim: Math.max(s.inicio_linha, s.fim_linha),
      proporcao_ruido: s.proporcao_ruido,
    })),
    compromissos: r.compromissos,
    descartados: descartados.length,
  };
}

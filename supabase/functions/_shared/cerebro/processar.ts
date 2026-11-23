// SPEC 169: pipeline da reunião, com o modelo e o banco injetados para testar sem rede.
// Ordem: redigir, glossário, gravar a reunião (só o texto redigido), chamar o modelo,
// aterrar, gravar os achados. O transcript cru nunca é gravado nem logado; erro registra
// só o id da reunião.
import { aplicarGlossario } from "./glossario.ts";
import { montarLinhas, numerarLinhas, type LinhasParaGravar } from "./montar.ts";
import { respostaSchema, systemPrompt, userMessage, type RespostaModelo } from "./prompt.ts";
import { redigir } from "./redacao.ts";
import type { EntradaReuniao } from "./entrada.ts";

export interface RespostaDoModelo {
  data: RespostaModelo;
  tokensEntrada: number;
  tokensSaida: number;
}

export interface Dependencias {
  chamarModelo(system: string, user: string): Promise<RespostaDoModelo>;
  criarReuniao(r: {
    titulo: string;
    ocorreu_em: string;
    origem_nome: string | null;
    origem_contato: string | null;
    transcript_redigido: string;
    redacoes: Record<string, number>;
    criado_por: string;
  }): Promise<string>;
  gravarAnalise(reuniaoId: string, linhas: LinhasParaGravar): Promise<void>;
  marcarFalha(reuniaoId: string): Promise<void>;
}

export type Resultado =
  | {
      ok: true;
      reuniao_id: string;
      insights: number;
      descartados: number;
      compromissos: number;
      tokensEntrada: number;
      tokensSaida: number;
    }
  | { ok: false; reuniao_id: string; erro: "modelo_falhou" | "gravacao_falhou"; tokensEntrada: 0; tokensSaida: 0 };

export async function processarReuniao(
  deps: Dependencias,
  entrada: EntradaReuniao,
  userId: string
): Promise<Resultado> {
  const { texto: redigido, contagem } = redigir(entrada.transcript);
  const limpo = aplicarGlossario(redigido);

  const reuniaoId = await deps.criarReuniao({
    titulo: entrada.titulo,
    ocorreu_em: entrada.ocorreu_em,
    origem_nome: entrada.origem_nome ?? null,
    origem_contato: entrada.origem_contato ?? null,
    transcript_redigido: limpo,
    redacoes: contagem,
    criado_por: userId,
  });

  let resposta: RespostaDoModelo;
  try {
    resposta = await deps.chamarModelo(
      systemPrompt(),
      userMessage(entrada.titulo, entrada.ocorreu_em, numerarLinhas(limpo))
    );
    respostaSchema.parse(resposta.data);
  } catch {
    await deps.marcarFalha(reuniaoId);
    return { ok: false, reuniao_id: reuniaoId, erro: "modelo_falhou", tokensEntrada: 0, tokensSaida: 0 };
  }

  const linhas = montarLinhas(limpo, resposta.data);
  try {
    await deps.gravarAnalise(reuniaoId, linhas);
  } catch {
    await deps.marcarFalha(reuniaoId);
    return { ok: false, reuniao_id: reuniaoId, erro: "gravacao_falhou", tokensEntrada: 0, tokensSaida: 0 };
  }

  return {
    ok: true,
    reuniao_id: reuniaoId,
    insights: linhas.insights.length,
    descartados: linhas.descartados,
    compromissos: linhas.compromissos.length,
    tokensEntrada: resposta.tokensEntrada,
    tokensSaida: resposta.tokensSaida,
  };
}
